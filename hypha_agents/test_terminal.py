"""Terminal service testing module.

This module contains tests for the terminal service functionality, including
creating sessions, writing commands, reading output, and resizing terminals.
"""

import asyncio
import logging
from hypha_rpc import login, connect_to_server

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def test_terminal_service():
    """Test the terminal service functionality."""
    try:
        # Authenticate and connect to the server
        token = await login({"server_url": "https://hypha.aicell.io"})
        server = await connect_to_server(
            {"server_url": "https://hypha.aicell.io", "token": token}
        )
        print("Connected to Hypha server")

        # Get the terminal service
        terminal_service = await server.get_service("terminal-service")
        print("Retrieved terminal service")

        # Create a new terminal session
        session_id = "test-session"
        size = {"rows": 24, "cols": 80}
        create_response = await terminal_service.create_terminal(
            size_dict=size, session_id=session_id
        )
        print(f"Created terminal session: {create_response}")

        # Test 1: Generate lots of output
        print("\n=== Test 1: Generate lots of output ===")
        await terminal_service.write_to_terminal(
            {
                "session_id": session_id,
                "data": 'for i in {1..100}; do echo "Line $i: $(date)"; done\n',
            }
        )
        await asyncio.sleep(2)  # Wait for command to complete

        # Read with different max_lines values
        for max_lines in [10, 20, 50]:
            output = await terminal_service.read_from_terminal(session_id)
            if output:
                print(f"\nReading last {max_lines} lines:")
                print(f"Output truncated: {output['truncated']}")
                print(f"Number of lines: {len(output['data'].splitlines())}")
                print("Content:")
                print(output["data"])

        # Test 2: Continuous output with history
        print("\n=== Test 2: Continuous output with history ===")
        await terminal_service.write_to_terminal(
            {
                "session_id": session_id,
                "data": 'for i in {1..5}; do echo "Batch $i"; seq 1 5; sleep 1; done\n',
            }
        )

        # Read progress with different max_lines
        for i in range(6):
            await asyncio.sleep(1)
            # Read last 10 lines
            output = await terminal_service.read_from_terminal(session_id)
            if output:
                print(f"\nProgress check {i+1} (last 10 lines):")
                print(f"Truncated: {output['truncated']}")
                print(output["data"])

        # Test 3: Read entire history
        print("\n=== Test 3: Read entire history ===")
        output = await terminal_service.read_from_terminal(session_id)  # No max_lines
        if output:
            print(f"Total history lines: {len(output['data'].splitlines())}")
            print(f"Truncated: {output['truncated']}")

        # Test 4: Test terminal resize
        print("\n=== Test 4: Test terminal resize ===")
        new_size = {"rows": 30, "cols": 100}
        await terminal_service.resize_terminal(
            size_dict=new_size, session_id=session_id
        )
        print("Terminal resized")

        # Write something to see the effect
        await terminal_service.write_to_terminal(
            {
                "session_id": session_id,
                "data": "echo 'Testing new terminal size'; seq 1 20\n",
            }
        )
        await asyncio.sleep(1)
        output = await terminal_service.read_from_terminal(session_id)
        if output:
            print("Output after resize:")
            print(output["data"])

        # Close the terminal session
        await terminal_service.close_terminal(session_id=session_id)
        print("Closed terminal session")

    except Exception as e:
        logger.error("Error during terminal testing: %s", str(e))
        raise


if __name__ == "__main__":
    asyncio.run(test_terminal_service())
