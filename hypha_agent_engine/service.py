"""Service module for Hypha Agent Platform.

This module provides functionality to connect to a Hypha server and
register agent services for the Hypha Agent Platform.
"""

import os
import logging

from dotenv import load_dotenv
from hypha_rpc import connect_to_server, login
from hypha_agent_engine.hypha_service import register_agent_service
from hypha_agent_engine.asgi_service import register_frontend_service

# from hypha_agent_engine.services.plotting import register_plotting_service

# Load environment variables
load_dotenv(override=True)

# Configure logger to print to stdout
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
)
logger.addHandler(handler)


async def start_service(server_url: str = "https://hypha.aicell.io") -> None:
    """Start the Hypha service and manage its lifecycle.

    Args:
        server_url: URL of the Hypha server to connect to
    """
    server = None
    try:
        if os.getenv("WORKSPACE_TOKEN"):
            token = os.getenv("WORKSPACE_TOKEN")
        else:
            token = await login({"server_url": server_url})
        # Connect to Hypha server
        server = await connect_to_server({"server_url": server_url, "token": token})

        # Register agent service
        agent_svc = await register_agent_service(server)
        logger.info(
            "Hypha service started successfully. Agent service ID: %s", agent_svc.id
        )

        frontend_service = await register_frontend_service(
            server, os.getenv("WORKSPACE"), "agent-platform", "build"
        )
        logger.info(
            "Frontend service started successfully. Service ID: %s", frontend_service.id
        )

        # Register plotting service
        # plotting_svc = await register_plotting_service(server)
        # logger.info("Plotting service started successfully. Service ID: %s", plotting_svc.id)

        # Run the service
        await server.serve()

    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error("Error running service: %s", str(e))
        raise
    finally:
        if server:
            await server.close()
            logger.info("Hypha service stopped")
