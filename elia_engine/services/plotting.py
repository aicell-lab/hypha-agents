from typing import Dict, Any
import plotly.graph_objects as go
import plotly.utils
import json
import logging
from hypha_rpc.utils.schema import schema_function
from pydantic import Field
logger = logging.getLogger(__name__)

@schema_function
async def plot(figure_spec: dict=Field(..., description="Dictionary containing Plotly figure specifications")) -> str:
    """Create a Plotly figure from a specification and return JSON data.
    
    Args:
        figure_spec: Dictionary containing Plotly figure specifications
            Example: {
                "type": "scatter",
                "x": [1, 2, 3],
                "y": [4, 5, 6],
                "mode": "lines+markers"
            }
    
    Returns:
        JSON string containing the Plotly figure data
    """
    try:
        print(f"=======> making plot with {figure_spec}")
        # Create figure based on type
        fig_type = figure_spec.pop("type", "scatter")
        
        # Get the appropriate figure class
        fig_class = getattr(go, fig_type.capitalize())
        
        # Create the trace
        trace = fig_class(**figure_spec)
        
        # Create the figure
        fig = go.Figure(data=[trace])
        
        # Convert to JSON
        fig_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        print(f"=======> plot created: {fig_json}")
        return fig_json
    
    except Exception as e:
        logger.error(f"Error creating plot: {str(e)}")
        raise

async def register_plotting_service(server):
    """Register the plotting service with Hypha server.
    
    Args:
        server: Hypha server instance
    
    Returns:
        Registered service instance
    """
    svc = await server.register_service({
        "name": "Plotting Service",
        "id": "plotting-service",
        "description": "A service for plotting data",
        "config": {
            "visibility": "public"
        },
        "plot": plot
    })
    
    return svc 