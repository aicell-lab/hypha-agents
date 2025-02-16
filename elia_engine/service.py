from hypha_rpc import connect_to_server, login
from elia_engine.hypha_service import register_agent_service
from elia_engine.services.plotting import register_plotting_service
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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
        token = await login({"server_url": server_url})
        # Connect to Hypha server
        server = await connect_to_server({"server_url": server_url, "token": token})
        
        # Register agent service
        agent_svc = await register_agent_service(server)
        logger.info(f"Elia service started successfully. Agent service ID: {agent_svc.id}")
        
        # Register plotting service
        # plotting_svc = await register_plotting_service(server)
        # logger.info(f"Plotting service started successfully. Service ID: {plotting_svc.id}")
        
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