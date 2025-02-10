import asyncio
from typing import Optional
from hypha_rpc import connect_to_server
from schema_agents.hypha_service import register_agent_service
import logging

# Configure logger to print to stdout
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)

async def start_service(server_url: str = "https://hypha.aicell.io") -> None:
    """Start the Elia service and manage its lifecycle.
    
    Args:
        server_url: URL of the Hypha server to connect to
    """
    server = None
    try:
        # Connect to Hypha server
        server = await connect_to_server(server_url=server_url)
        
        # Register agent service
        agent_svc = await register_agent_service(server)
        logger.info(f"Elia service started successfully. Agent service ID: {agent_svc.id}")
        
        # Run the service
        await server.serve()
        
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Error running service: {str(e)}")
        raise
    finally:
        if server:
            await server.close()
            logger.info("Elia service stopped") 