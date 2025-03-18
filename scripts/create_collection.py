import os
from dotenv import load_dotenv
from hypha_rpc import connect_to_server

# Load environment variables from .env file
load_dotenv()

SERVER_URL = os.getenv("SERVER_URL", "https://hypha.aicell.io")
SITE_ID = os.getenv("REACT_APP_SITE_ID", "hypha-agent-platform")
SITE_NAME = os.getenv("REACT_APP_SITE_NAME", "Hypha Agent Platform")

async def create_collection():
    server = await connect_to_server({
        "server_url": SERVER_URL,
        "workspace": SITE_ID,
        "token": os.environ.get("WORKSPACE_TOKEN")
    })
    artifact_manager = await server.get_service("public/artifact-manager")

    collection = await artifact_manager.create(
        alias=f"{SITE_ID}/agents",
        type="collection",
        manifest={
            "name": f"{SITE_NAME} Agents",
            "description": f"A collection of AI agents and resources for the {SITE_NAME}",
            "version": "0.1.0",
            "authors": [],
            "tags": [SITE_ID],
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