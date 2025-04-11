import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
        
        // Process command
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
      className="bg-black text-green-500 font-mono p-2 h-full overflow-auto"
      ref={terminalRef}
      onClick={() => inputRef.current?.focus()}
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

export const ThebeStatus: React.FC = () => {
  const { isReady, status, interruptKernel, restartKernel, kernelInfo, kernel } = useThebe();
  const [isOpen, setIsOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const terminalRef = useRef<{ pushToStdout: (text: string) => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get button position for desktop dropdown positioning
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonPosition, setButtonPosition] = useState<{ top: number; right: number } | null>(null);

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

  // Initialize kernel info when terminal is opened
  useEffect(() => {
    if (isOpen && kernel && isReady && terminalRef.current) {
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
  }, [isOpen, kernel, isReady]);

  const handleRestart = async () => {
    try {
      setIsRestarting(true);
      if (terminalRef.current) {
        terminalRef.current.pushToStdout("\n=== Restarting Kernel ===\n");
      }
      await restartKernel();
      
      if (kernel && isReady && terminalRef.current) {
        terminalRef.current.pushToStdout("Kernel restarted successfully.\n");
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

    // Show command in output
    if (terminalRef.current) {
      terminalRef.current.pushToStdout(`\n>>> ${command}\n`);
    }

    try {
      if (kernel && isReady) {
        const future = kernel.requestExecute({ code: command });
        future.onIOPub = handleIOPubMessage;
        await future.done;
      }
    } catch (error) {
      if (terminalRef.current) {
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

  const terminalCommands = {
    'restart': {
      method: () => {
        handleRestart();
        return 'Restarting kernel...';
      },
      options: [],
    },
    'interrupt': {
      method: () => {
        handleInterrupt();
        return 'Interrupting kernel...';
      },
      options: [],
    },
    'status': {
      method: () => {
        return `Kernel status: ${status}`;
      },
      options: [],
    },
    'clear': {
      method: () => {
        return 'Terminal cleared';
      },
      options: [],
    },
    'help': {
      method: () => {
        return `
Available commands:
  restart    - Restart the Python kernel
  interrupt  - Interrupt the running kernel
  status     - Show kernel status
  clear      - Clear the terminal
  help       - Show this help message

Any other input will be executed as Python code.
        `;
      },
      options: [],
    },
  };

  const terminalDescriptions = {
    'restart': 'Restart the Python kernel',
    'interrupt': 'Interrupt the running kernel',
    'status': 'Show kernel status',
    'clear': 'Clear the terminal',
    'help': 'Show available commands',
  };

  // Update position when panel opens or on resize
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const panel = document.querySelector('[data-thebe-panel]') as HTMLElement;
      const container = containerRef.current;
      
      if (!panel || !container) return;
      
      const rect = container.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      
      if (!isMobile) {
        panel.style.position = 'fixed';
        panel.style.top = `${rect.bottom + 8}px`;
        panel.style.right = `${window.innerWidth - rect.right}px`;
        panel.style.maxHeight = `calc(100vh - ${rect.bottom + 24}px)`;
        panel.style.left = 'auto';
        panel.style.bottom = 'auto';
      } else {
        panel.style.position = 'fixed';
        panel.style.top = '0';
        panel.style.right = '0';
        panel.style.bottom = '0';
        panel.style.left = '0';
        panel.style.maxHeight = '100dvh';
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-colors ${getStatusColor()} hover:bg-gray-50`}
        title={getStatusText()}
      >
        {getStatusIcon()}
      </button>

      {/* Terminal Dropdown */}
      {isOpen && createPortal(
        <>
          {/* Mobile overlay backdrop */}
          <div className="fixed inset-0 bg-black/50 z-[899] sm:hidden" onClick={() => setIsOpen(false)} />
          
          {/* Panel */}
          <div className="
            fixed sm:fixed inset-0 sm:inset-auto sm:bottom-12 sm:right-4 
            w-full sm:w-[600px] bg-white sm:rounded-lg shadow-lg 
            border border-gray-200 z-[900] flex flex-col 
            max-h-[100dvh] sm:max-h-[90vh]
          ">
            {/* Status Section */}
            <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-gray-50 sm:rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium text-base">
                    Python {kernelInfo.pythonVersion || '...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 ${getStatusColor()}`}>
                    <span className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')}`} />
                    <span className="text-sm">{getStatusText()}</span>
                  </div>
                  {/* Close button - visible on all screens */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    aria-label="Close terminal"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Terminal Component */}
            <div className="flex-1 min-h-0">
              <CustomTerminal
                ref={terminalRef}
                commands={terminalCommands}
                description={terminalDescriptions}
                msg="Python Terminal - Type 'help' for available commands"
                promptSymbol=">>>"
                onCommand={executeCommand}
              />
            </div>

            {/* Actions Section */}
            <div className="p-3 bg-gray-50 sm:rounded-b-lg flex-shrink-0">
              <div className="flex gap-2">
                {/* Restart Button */}
                <button
                  className="flex-1 text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2 transition-colors"
                  onClick={handleRestart}
                  disabled={!isReady || isRestarting}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isRestarting ? 'Restarting...' : 'Restart Kernel'}
                </button>
                
                {/* Interrupt Button - Only show when kernel is busy */}
                {status === 'busy' ? (
                  <button
                    className="flex-1 text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2 transition-colors"
                    onClick={handleInterrupt}
                    disabled={!isReady || isRestarting}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1-1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Interrupt Kernel
                  </button>
                ) : (
                  <button
                    className="flex-1 text-left px-3 py-2 text-sm text-gray-400 bg-gray-50 rounded flex items-center gap-2 cursor-not-allowed"
                    disabled
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1-1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Interrupt Kernel
                  </button>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}; 
