import os
from dotenv import load_dotenv
from hypha_rpc import connect_to_server

# Load environment variables from .env file
load_dotenv()

SERVER_URL = os.getenv("SERVER_URL", "https://hypha.aicell.io")

async def create_collection():
    server = await connect_to_server({
        "server_url": SERVER_URL,
        "workspace": "elia-platform",
        "token": os.environ.get("WORKSPACE_TOKEN")
    })
    artifact_manager = await server.get_service("public/artifact-manager")

    collection = await artifact_manager.create(
        alias="elia-platform/agents",
        type="collection",
        manifest={
            "name": "Elia Platform Agents",
            "description": "A collection of AI agents and resources for the Elia Platform",
            "version": "0.1.0",
            "authors": [],
            "tags": ["elia-platform", "ai-agents", "telecom"],
            "license": "MIT",
            "documentation": "",
            "covers": [],
            "badges": [],
            "links": []
        },
        config={
            "permissions": {"*": "r", "@": "r+"},
        },
        overwrite=True
    )
    print(f"Collection created: {collection}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(create_collection()) 