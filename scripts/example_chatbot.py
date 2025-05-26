import asyncio
import re
import inspect
from pydantic import BaseModel
from hypha_rpc import connect_to_server, login
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SITE_NAME = os.getenv("REACT_APP_SITE_NAME", "Hypha Agents")

async def main(server_url):
    # server = await connect_to_server({
    #     "server_url": ,
    # })
    token = await login({"server_url": server_url, "ssl": False})
    server = await connect_to_server(
        {"server_url": server_url, "token": token, "client_id": "chatbot", "method_timeout": 100, "ssl": False}
    )
    svc = await server.register_service({
        "name": "Schema Agents",
        "id": "schema-agents",
        "config": {
            "visibility": "public"
        },
        # "aask": aask,
        "acall": acall,
        "manifest": {
            "name": f"{SITE_NAME}",
        },
    })
    print(f"Agent service registered: {svc.id}")
    await server.serve()

async def acall(question, agent_config, tools=None, services=None, streaming_callback=None, **kwargs):
    return "hello world"


if __name__ == "__main__":
    # server_url = "https://hypha-gaia-8495.azeuslx0056.eus.az.ericsson.se"
    server_url = "https://hypha.aicell.io"
    asyncio.run(main(server_url))
