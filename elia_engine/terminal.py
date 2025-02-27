import asyncio
import os
import pty
import select
import struct
import termios
import fcntl
import pyte
import logging
from typing import Dict, Optional
from dataclasses import dataclass
from pydantic import BaseModel
from hypha_rpc import login, connect_to_server

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TerminalSize(BaseModel):
    rows: int = 24
    cols: int = 80

class TerminalInput(BaseModel):
    data: str
    session_id: str

class TerminalOutput(BaseModel):
    data: str
    session_id: str
    truncated: bool = False  # Indicates if output was truncated

@dataclass
class TerminalSession:
    fd: int
    pid: int
    session_id: str
    screen: pyte.Screen
    stream: pyte.Stream
    last_activity: float
    history: list[str] = None  # Store historical lines
    max_history_lines: int = 1000  # Maximum number of history lines to keep

    def __post_init__(self):
        self.history = []

class TerminalManager:
    def __init__(self):
        self.sessions: Dict[str, TerminalSession] = {}
        print("Terminal manager initialized")
    
    def create_session(self, session_id: str, size: TerminalSize) -> None:
        """Create a new terminal session."""
        print(f"Creating terminal session {session_id} with size {size.rows}x{size.cols}")
        
        # Create screen and stream
        screen = pyte.Screen(size.cols, size.rows)
        stream = pyte.Stream(screen)
        
        # Fork a new PTY
        pid, fd = pty.fork()
        
        if pid == 0:  # Child process
            # Execute shell
            shell = os.environ.get('SHELL', '/bin/bash')
            print(f"Executing shell: {shell}")
            os.execvp(shell, [shell])
        else:  # Parent process
            print(f"Terminal process started with PID: {pid}")
            # Set terminal size
            winsize = struct.pack("HHHH", size.rows, size.cols, 0, 0)
            fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
            
            # Make the PTY non-blocking
            flags = fcntl.fcntl(fd, fcntl.F_GETFL)
            fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            
            # Store session
            self.sessions[session_id] = TerminalSession(
                fd=fd,
                pid=pid,
                session_id=session_id,
                screen=screen,
                stream=stream,
                last_activity=asyncio.get_event_loop().time()
            )
            print(f"Terminal session {session_id} created successfully")
    
    def write_to_terminal(self, session_id: str, data: str) -> None:
        """Write data to the terminal."""
        if session_id not in self.sessions:
            logger.error(f"Session {session_id} not found")
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        logger.debug(f"Writing to terminal {session_id}: {data.strip()}")
        os.write(session.fd, data.encode())
        session.last_activity = asyncio.get_event_loop().time()
        logger.debug(f"Write to terminal {session_id} completed")
    
    async def read_from_terminal(self, session_id: str, max_lines: Optional[int] = None) -> Optional[TerminalOutput]:
        """Read data from the terminal."""
        if session_id not in self.sessions:
            logger.error(f"Session {session_id} not found")
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        logger.debug(f"Reading from terminal {session_id}")
        
        # Check if there's data to read
        r, _, _ = select.select([session.fd], [], [], 0)
        if not r:
            logger.debug(f"No new data available for terminal {session_id}")
            return self._get_terminal_output(session, max_lines)
        
        try:
            # Read in chunks to handle large outputs
            chunk_size = 4096
            data = ""
            
            while True:
                try:
                    chunk = os.read(session.fd, chunk_size).decode()
                    if not chunk:
                        break
                    data += chunk
                    logger.debug(f"Read chunk of size {len(chunk)} from terminal {session_id}")
                except (OSError, IOError):
                    break
            
            if data:
                logger.debug(f"Processing {len(data)} bytes of data from terminal {session_id}")
                # Feed data to the screen
                session.stream.feed(data)
                
                # Update history with new lines
                current_display = session.screen.display
                session.history.extend(current_display)
                
                # Trim history if it exceeds max size
                if len(session.history) > session.max_history_lines:
                    logger.debug(f"Trimming history for terminal {session_id} ({len(session.history)} -> {session.max_history_lines})")
                    session.history = session.history[-session.max_history_lines:]
                
                session.last_activity = asyncio.get_event_loop().time()
            
            return self._get_terminal_output(session, max_lines)
            
        except (OSError, IOError) as e:
            logger.error(f"Error reading from terminal {session_id}: {str(e)}")
            return None
    
    def _get_terminal_output(self, session: TerminalSession, max_lines: Optional[int] = None) -> TerminalOutput:
        """Get terminal output, optionally limited to max_lines."""
        # Combine history with current screen content
        all_lines = session.history + list(session.screen.display)
        
        # Remove empty lines from the end
        while all_lines and not all_lines[-1].strip():
            all_lines.pop()
        
        truncated = False
        if max_lines is not None and len(all_lines) > max_lines:
            logger.debug(f"Truncating output from {len(all_lines)} to {max_lines} lines")
            all_lines = all_lines[-max_lines:]  # Get last max_lines
            truncated = True
        
        return TerminalOutput(
            data="\n".join(all_lines),
            session_id=session.session_id,
            truncated=truncated
        )
    
    def resize_terminal(self, session_id: str, size: TerminalSize) -> None:
        """Resize the terminal."""
        if session_id not in self.sessions:
            logger.error(f"Session {session_id} not found")
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        print(f"Resizing terminal {session_id} to {size.rows}x{size.cols}")
        
        # Update terminal size
        winsize = struct.pack("HHHH", size.rows, size.cols, 0, 0)
        fcntl.ioctl(session.fd, termios.TIOCSWINSZ, winsize)
        
        # Update screen size
        session.screen.resize(size.rows, size.cols)
        print(f"Terminal {session_id} resized successfully")
    
    def close_session(self, session_id: str) -> None:
        """Close a terminal session."""
        if session_id not in self.sessions:
            logger.warning(f"Attempted to close non-existent session {session_id}")
            return
        
        session = self.sessions[session_id]
        print(f"Closing terminal session {session_id}")
        try:
            os.close(session.fd)
            os.kill(session.pid, 9)
            print(f"Terminal process {session.pid} terminated")
        except (OSError, ProcessLookupError) as e:
            logger.warning(f"Error while closing session {session_id}: {str(e)}")
        
        del self.sessions[session_id]
        print(f"Terminal session {session_id} closed")

async def register_terminal_service(server):
    """Register the terminal service with Hypha."""
    print("Initializing terminal service")
    terminal_manager = TerminalManager()
    
    async def create_terminal(size_dict: dict, session_id: str):
        """Create a new terminal session.
        
        Args:
            size_dict: Dictionary containing rows and cols
            session_id: Session identifier
        """
        print(f"Service: Creating terminal session {session_id}")
        size = TerminalSize(**size_dict)
        terminal_manager.create_session(session_id, size)
        return {"status": "success", "session_id": session_id}
    
    async def write_to_terminal(input_dict: dict):
        """Write data to a terminal session.
        
        Args:
            input_dict: Dictionary containing session_id and data
        """
        logger.debug(f"Service: Writing to terminal {input_dict.get('session_id')}")
        input_data = TerminalInput(**input_dict)
        terminal_manager.write_to_terminal(input_data.session_id, input_data.data)
        return {"status": "success"}
    
    async def read_from_terminal(session_id: str):
        """Read data from a terminal session."""
        logger.debug(f"Service: Reading from terminal {session_id}")
        output = await terminal_manager.read_from_terminal(session_id)
        if output is not None:
            # Convert TerminalOutput to dict
            return {
                "data": output.data,
                "session_id": output.session_id,
                "truncated": output.truncated
            }
        return None
    
    async def resize_terminal(size_dict: dict, session_id: str):
        """Resize a terminal session.
        
        Args:
            size_dict: Dictionary containing rows and cols
            session_id: Session identifier
        """
        print(f"Service: Resizing terminal {session_id}")
        size = TerminalSize(**size_dict)
        terminal_manager.resize_terminal(session_id, size)
        return {"status": "success"}
    
    async def close_terminal(session_id: str):
        """Close a terminal session."""
        print(f"Service: Closing terminal {session_id}")
        terminal_manager.close_session(session_id)
        return {"status": "success"}
    
    svc = await server.register_service({
        "name": "Terminal Service",
        "id": "terminal-service",
        "config": {
            "visibility": "public"
        },
        "create_terminal": create_terminal,
        "write_to_terminal": write_to_terminal,
        "read_from_terminal": read_from_terminal,
        "resize_terminal": resize_terminal,
        "close_terminal": close_terminal,
    })
    
    print(f"Terminal service registered with ID: {svc.id}")
    return svc

async def main():
    """Main entry point for the terminal service."""
    print("Starting terminal service")
    try:
        # Authenticate and connect to the server
        print("Authenticating with Hypha server")
        token = await login({"server_url": "https://hypha.aicell.io"})
        print("Connecting to Hypha server")
        server = await connect_to_server({
            "server_url": "https://hypha.aicell.io",
            "token": token
        })
        print("Connected to Hypha server")
        
        svc = await register_terminal_service(server)
        print(f"Terminal service registered: {svc.id}")
        print("Starting service loop")
        await server.serve()
    except Exception as e:
        logger.error(f"Error in main: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    asyncio.run(main()) 