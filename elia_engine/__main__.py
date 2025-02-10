"""
Main entry point for the Elia Engine
"""

import asyncio
import click
import logging

from .service import start_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@click.group()
def cli():
    """Elia Engine - Backend service for AI agent runtime."""
    pass

@cli.command()
@click.option('--server-url', default="https://hypha.aicell.io", help="Hypha server URL")
def serve(server_url: str):
    """Start the Elia service."""
    try:
        click.echo(f"Starting Elia service on {server_url}")
        asyncio.run(start_service(server_url=server_url))
    except KeyboardInterrupt:
        click.echo("\nShutting down...")

if __name__ == "__main__":
    cli() 