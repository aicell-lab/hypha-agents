import React, { useState, useEffect, useRef } from 'react';
import { useThebe } from './ThebeProvider';

// Custom Terminal Component
interface TerminalProps {
  commands?: Record<string, { method: () => string; options: string[] }>;
  description?: Record<string, string>;
  msg?: string;
  promptSymbol?: string;
  onCommand: (command: string) => void;
}

const CustomTerminal = React.forwardRef<{ pushToStdout: (text: string) => void }, TerminalProps>(({
  commands = {},
  description = {},
  msg = 'Terminal',
  promptSymbol = '>',
  onCommand
}, ref) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [output, setOutput] = useState<string[]>([msg]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [output]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = input.trim();
      
      if (cmd) {
        // Add to history
        setHistory(prev => [...prev, cmd]);
        setHistoryIndex(-1);
        
        // Display command
        setOutput(prev => [...prev, `${promptSymbol} ${cmd}`]);
        
        // Process command (Reverted)
        if (commands[cmd] && typeof commands[cmd].method === 'function') {
          const result = commands[cmd].method();
          if (result) {
            setOutput(prev => [...prev, result]);
          }
        } else {
          onCommand(cmd);
        }
        
        // Clear input
        setInput('');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const pushToStdout = (text: string) => {
    setOutput(prev => [...prev, text]);
  };

  // Expose methods to parent component
  React.useImperativeHandle(ref, () => ({
    pushToStdout
  }));

  return (
    <div 
      className="bg-black text-green-500 font-mono h-full overflow-auto"
      ref={terminalRef}
      onClick={() => {
        // Only focus input if no text is selected, allows copying
        if (window.getSelection()?.toString() === '') {
            inputRef.current?.focus();
        }
      }}
    >
      {output.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap">{line}</div>
      ))}
      <div className="flex">
        <span>{promptSymbol}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent outline-none border-none flex-1 ml-1"
          autoFocus
          aria-label="Terminal input"
          placeholder="Type a command..."
        />
      </div>
    </div>
  );
});

// Function to strip ANSI escape codes
const stripAnsi = (str: string): string => {
  // Regular expression to match ANSI escape codes
  const ansiRegex = /\u001b\[([0-9]{1,3}(;[0-9]{1,3})*)?[m|K|H|f|J]/g;
  return str.replace(ansiRegex, '');
};

// Rename and refactor ThebeStatus to ThebeTerminalPanel
export const ThebeTerminalPanel: React.FC = () => {
  const { 
    isReady, status, interruptKernel, restartKernel, kernelInfo, kernel, 
    kernelExecutionLog, addKernelLogEntry, executeCode
  } = useThebe();
  const [isRestarting, setIsRestarting] = useState(false);
  const terminalRef = useRef<{ pushToStdout: (text: string) => void } | null>(null);
  const logIndexRef = useRef<number>(0);

  // Helper function to handle IOPub messages
  const handleIOPubMessage = (msg: any) => {
    const msgType = msg.header.msg_type;
    
    switch (msgType) {
      case 'stream':
        if (terminalRef.current) {
          terminalRef.current.pushToStdout(msg.content.text);
        }
        break;
      case 'display_data':
      case 'execute_result':
        const data = msg.content.data;
        if (data['text/plain'] && terminalRef.current) {
          terminalRef.current.pushToStdout(data['text/plain'] + '\n');
        }
        if (data['text/html'] && terminalRef.current) {
          terminalRef.current.pushToStdout('[HTML Output]\n');
        }
        if ((data['image/png'] || data['image/jpeg']) && terminalRef.current) {
          terminalRef.current.pushToStdout('[Image Output]\n');
        }
        break;
      case 'error':
        if (terminalRef.current) {
          const errorText = msg.content.traceback.join('\n');
          terminalRef.current.pushToStdout(`\x1b[31m${errorText}\x1b[0m\n`);
        }
        break;
    }
  };

  // Initialize kernel info when terminal is mounted
  useEffect(() => {
    if (kernel && isReady && terminalRef.current) {
      terminalRef.current.pushToStdout("Initializing Python environment...\n");
      kernel.requestExecute({
        code: `
import sys
import pyodide
import platform

print(f"Python {sys.version}")
print(f"Pyodide {pyodide.__version__}")
print(f"Platform: {platform.platform()}")
print(f"Path: {sys.path}")
`
      }).onIOPub = handleIOPubMessage;
    }
    // Clean up listener if component unmounts or kernel changes
    return () => {
      // Potentially remove IOPub handler if needed, though kernel instance changing might handle it
    };
  }, [kernel, isReady]);

  const handleRestart = async () => {
    try {
      setIsRestarting(true);
      if (terminalRef.current) {
        terminalRef.current.pushToStdout("\n=== Restarting Kernel ===\n");
      }
      await restartKernel();
    } catch (error) {
      console.error('Failed to restart kernel:', error);
      if (terminalRef.current) {
        terminalRef.current.pushToStdout(`\x1b[31mError: Failed to restart kernel: ${error}\x1b[0m\n`);
      }
    } finally {
      setIsRestarting(false);
    }
  };

  const handleInterrupt = async () => {
    try {
      if (terminalRef.current) {
        terminalRef.current.pushToStdout('\n=== Interrupting Kernel ===\n');
      }
      await interruptKernel();
    } catch (error) {
      console.error('Failed to interrupt kernel:', error);
      if (terminalRef.current) {
        terminalRef.current.pushToStdout(`\x1b[31mError: Failed to interrupt kernel: ${error}\x1b[0m\n`);
      }
    }
  };

  const executeCommand = async (command: string) => {
    if (!command.trim()) return;
    // Logging is now handled within executeCode in ThebeProvider
    // We still call it for interactive commands
    try {
      if (kernel && isReady) {
        // Trigger the provider's executeCode which handles logging
        await executeCode(command, {
          onOutput: (output: { type: string; content: string; short_content?: string; attrs?: any }) => {
            // Optional: handle interactive output specifically if needed, 
            // but logging is primary
            console.log('Interactive output:', output); // Example
          },
          onStatus: (status: string) => {
            // Optional: handle interactive status specifically
            console.log('Interactive status:', status); // Example
          }
        });
      } else {
        if (terminalRef.current) {
          const msg = "\x1b[31mError: Kernel not ready or not available.\x1b[0m\n";
          terminalRef.current.pushToStdout(msg);
          addKernelLogEntry({ type: 'error', content: msg.replace(/\x1b\[\d+m/g, '') }); // Log the error too
        }
      }
    } catch (error) {
      // Error logging is handled by executeCode
      if (terminalRef.current && !(error instanceof Error && error.message.includes('Execution timeout'))) {
        // Only push if not a timeout, as executeCode logs timeouts
        terminalRef.current.pushToStdout(`\x1b[31mError: ${error}\x1b[0m\n`);
      }
    }
  };

  const getStatusColor = () => {
    if (!isReady) return 'text-gray-400';
    switch (status) {
      case 'busy':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-green-500';
    }
  };

  const getStatusText = () => {
    if (!isReady) return 'Initializing...';
    if (isRestarting) return 'Restarting...';
    switch (status) {
      case 'busy':
        return 'Kernel Busy';
      case 'error':
        return 'Kernel Error';
      default:
        return 'Kernel Ready';
    }
  };

  const getStatusIcon = () => {
    if (!isReady || isRestarting) {
      return (
        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    }
    switch (status) {
      case 'busy':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  // Needed for the clear command - Define state BEFORE using it in terminalCommands
  const [output, setOutput] = useState<string[]>([]);

  // Terminal command definitions (simplified as some actions removed)
  const terminalCommands = {
      // 'restart': { ... }, // Removed
      // 'interrupt': { ... }, // Removed
      'status': { // Keep status command if needed
        method: () => {
          addKernelLogEntry({ type: 'input', content: 'status' });
          const msg = `Kernel status: ${status}`;
          addKernelLogEntry({ type: 'output', content: msg }); 
          return msg;
        },
        options: [],
      },
      'help': { // Keep help command
        method: () => {
          addKernelLogEntry({ type: 'input', content: 'help' });
          const helpText = `
  Available commands:
    status     - Show kernel status
    clear      - Clear the terminal
    help       - Show this help message
  
  Any other input will be executed as Python code.
          `;
          addKernelLogEntry({ type: 'output', content: helpText }); 
          return helpText;
        },
        options: [],
      },
  };

  const terminalDescriptions = {
    'status': 'Show kernel status',
    'help': 'Show available commands',
    // Removed descriptions for restart/interrupt
  };

  // Effect to push log entries to the terminal
  useEffect(() => {
    if (terminalRef.current && kernelExecutionLog.length > logIndexRef.current) {
      const newEntries = kernelExecutionLog
        .slice(logIndexRef.current)
        .filter(entry => entry.type !== 'status'); // Filter out status messages

      newEntries.forEach(entry => {
        if (terminalRef.current) {
          let formattedEntry = '';
          const timeString = new Date(entry.timestamp).toLocaleTimeString();
          const cellPrefix = entry.cellId ? `[${entry.cellId.substring(0, 4)}]` : ''; 
          const strippedContent = stripAnsi(entry.content); // Strip ANSI codes here
          const firstLine = strippedContent.split('\n')[0];
          const ellipsis = strippedContent.includes('\n') ? ' ...' : '';

          switch (entry.type) {
            case 'input':
              // REMOVE Gray color for input prefix
              formattedEntry = `${timeString}${cellPrefix} <<< ${firstLine}${ellipsis}`; // Keep content default
              break;
            case 'output':
               // Default terminal color
              formattedEntry = `${timeString}${cellPrefix} >>> ${firstLine}${ellipsis}`;
              break;
            case 'error':
              // REMOVE Red color for prefix, keep content default
              // Add simple ERR prefix instead
              formattedEntry = `${timeString}${cellPrefix} ERR: ${firstLine}${ellipsis}`;
              break;
            // Status case removed by filter
          }
          // Push the ANSI-stripped, formatted entry
          terminalRef.current.pushToStdout(formattedEntry.trim() + '\n'); 
        }
      });
      logIndexRef.current = kernelExecutionLog.length; // Update the index based on original log length
    }
  }, [kernelExecutionLog]); 

  // Render the panel content directly - SIMPLIFIED LAYOUT
  return (
    <div className="flex flex-col h-full bg-black"> {/* Changed background */} 
      {/* REMOVED Status Header Section */}

      {/* Terminal Component takes full space */}
      <div className="flex-1 min-h-0"> {/* Ensure it can shrink and grow */} 
        <CustomTerminal
          ref={terminalRef}
          commands={terminalCommands} // Pass remaining commands
          description={terminalDescriptions}
          msg="Python Kernel Log" // Simplified message
          promptSymbol=">>>" 
          onCommand={executeCommand} 
        />
      </div>

      {/* REMOVED Actions Footer Section */}
    </div>
  );
};

export default ThebeTerminalPanel; 
