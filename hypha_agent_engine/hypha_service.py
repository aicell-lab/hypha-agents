"""Hypha service integration module for the Hypha Agent Platform.

This module provides functionality to integrate with the Hypha service,
including agent service registration, tool creation, and OpenAI token handling.
"""

import os
import asyncio
import re
import inspect
from pydantic import BaseModel
from hypha_rpc import connect_to_server
from schema_agents import Role
from schema_agents.role import create_session_context
from schema_agents.schema import StreamEvent
from schema_agents.utils.common import EventBus
from schema_agents.utils.jsonschema_pydantic import json_schema_to_pydantic_model
from schema_agents import schema_tool
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SITE_NAME = os.getenv("REACT_APP_SITE_NAME", "Hypha Agent Platform")

EXAMPLE_CODE = """

# example code for using matplotlib inline mode to make a simple plot
# and print some text
import matplotlib.pyplot as plt
# make inline
%matplotlib inline
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.plot(x, y)
plt.text(4, 0.5, "Hello, world!")
plt.show()

print("Hello, world!")

"""


def create_tool_name(svc_id, tool_id=""):
    """Create a formatted tool name from service ID and tool ID.

    Args:
        svc_id: The service identifier
        tool_id: Optional tool identifier

    Returns:
        A properly formatted and capitalized tool name
    """
    text = f"{svc_id}_{tool_id}"
    text = text.replace("-", " ").replace("_", " ").replace(".", " ")
    words = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)|\d+", text)
    return "".join(word if word.istitle() else word.capitalize() for word in words)


def tool_factory(svc_id, tool_id, tool_func, schema):
    """Create a tool from a function with schema.

    Args:
        svc_id: Service identifier
        tool_id: Tool identifier
        tool_func: Function to convert into a tool
        schema: JSON schema describing the tool's parameters

    Returns:
        A wrapped function configured as a schema_tool
    """
    schema["title"] = create_tool_name(svc_id, tool_id)
    schema["description"] = tool_func.__doc__
    input_model = json_schema_to_pydantic_model(schema, ref_template="$defs")

    func_name = create_tool_name(svc_id, tool_id)
    func_doc = input_model.__doc__ or tool_func.__doc__

    async def wrapper(*args, **kwargs):
        def convert_basemodel(obj):
            if isinstance(obj, BaseModel):
                return obj.model_dump(mode="json")
            elif isinstance(obj, dict):
                return {k: convert_basemodel(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_basemodel(item) for item in obj]
            return obj

        converted_args = [convert_basemodel(arg) for arg in args]
        converted_kwargs = {k: convert_basemodel(v) for k, v in kwargs.items()}

        result = tool_func(*converted_args, **converted_kwargs)
        if inspect.isawaitable(result):
            result = await result
        # convert results to dict
        return convert_basemodel(result)

    wrapper.__name__ = func_name
    wrapper.__doc__ = func_doc

    return schema_tool(wrapper, input_model=input_model)


async def aask(question, agent_config, streaming_callback=None, run_code=None):
    """Ask a question."""
    agent = Role(**agent_config)
    event_bus = EventBus("test")
    if streaming_callback:

        async def callback(response: StreamEvent):
            await streaming_callback(response.model_dump(mode="json"))

        event_bus.on("stream", callback)
    async with create_session_context(event_bus=event_bus):
        if run_code:
            results = await run_code(EXAMPLE_CODE)
            result_str = "\n\n code execution results: " + results
        else:
            result_str = ""
        return await agent.aask(question + result_str)


def extract_tools_from_service(service):
    """A utility function to extract functions nested in a service."""
    if isinstance(service, dict):
        for _, value in service.items():
            yield from extract_tools_from_service(value)
    elif isinstance(service, (list, tuple)):
        yield from extract_tools_from_service(service)
    elif callable(service):
        yield service


def normalize_service_name(text):
    """Normalize the service name to be used in the tool usage prompt."""
    text = text.replace("-", " ").replace("_", " ").replace(".", " ")
    words = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)|\d+", text)
    return "".join(word if word.istitle() else word.capitalize() for word in words)


async def get_realtime_token():
    """Get a realtime session token from OpenAI."""
    # Get the API key from environment variable
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    try:
        # Create session with OpenAI's realtime API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/sessions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": "gpt-4o-realtime-preview", "voice": "sage"},
            )
            response.raise_for_status()
            session_data = response.json()

            return session_data

    except httpx.HTTPError as e:
        raise ValueError(f"Failed to get realtime session: {str(e)}") from e
    except Exception as e:
        raise ValueError(f"Unexpected error getting realtime session: {str(e)}") from e


async def get_openai_token():
    """Get an OpenAI API key for use with the Chat Completions API."""
    # Get the API key from environment variable
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    try:
        # Return the API key in the same format as get_realtime_token for consistency
        return {"client_secret": {"value": api_key}}
    except Exception as e:
        raise ValueError(f"Unexpected error getting OpenAI API key: {str(e)}") from e


async def register_agent_service(server):
    """Register a service with the server."""

    async def acall(
        question,
        agent_config,
        tools=None,
        services=None,
        streaming_callback=None,
        run_code=None,
        **kwargs,
    ):
        """Ask a question."""
        agent = Role(**agent_config)
        event_bus = EventBus("test")
        if streaming_callback:

            async def callback(response: StreamEvent):
                await streaming_callback(response.model_dump(mode="json"))

            event_bus.on("stream", callback)

        tools = tools or []
        if tools:
            for t in tools:
                schema = t.__schema__
                t.__doc__ = schema["description"]
                tools.append(tool_factory("tool", t.__name__, t, schema["parameters"]))

        if services:
            service_prompts = []
            for service in services:
                if isinstance(service, str):
                    service = await server.get_service(service)

                svc_id = normalize_service_name(service["id"].split(":")[-1])
                ts = list(extract_tools_from_service(service))
                for t in ts:
                    schema = t.__schema__
                    t.__doc__ = schema["description"]
                    tools.append(
                        tool_factory(svc_id, t.__name__, t, schema["parameters"])
                    )

                svcd = service["description"].replace("\n", " ")
                service_prompts.append(f" - {svc_id}*: {svcd}\n")

            tool_usage_prompt = (
                "Tool usage guidelines (* represent the prefix of a tool group):\n"
                + "\n".join(service_prompts)
            )
        else:
            tool_usage_prompt = None

        async with create_session_context(event_bus=event_bus):
            if run_code:
                results = await run_code(EXAMPLE_CODE)
                print("code execution results: " + results)
            return await agent.acall(
                question, tools=tools, tool_usage_prompt=tool_usage_prompt, **kwargs
            )

    svc = await server.register_service(
        {
            "name": f"{SITE_NAME}",
            "id": "schema-agents",
            "config": {"visibility": "public"},
            "aask": aask,
            "acall": acall,
            "get_realtime_token": get_realtime_token,
            "get_openai_token": get_openai_token,
        }
    )
    return svc


async def main():
    """Main entry point for the Hypha service.

    Connects to the Hypha server, registers the agent service,
    and starts serving indefinitely.
    """
    server = await connect_to_server(
        {
            "server_url": "https://hypha.aicell.io",
        }
    )
    svc = await register_agent_service(server)
    print(f"Agent service registered: {svc.id}")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())
