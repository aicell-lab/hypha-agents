import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useThebe } from './ThebeProvider';

const MAX_LINES = 10000;
const MAX_HISTORY = 50;

export const ThebeStatus: React.FC = () => {
  const { isReady, status, interruptKernel, restartKernel, kernelInfo, kernel } = useThebe();
  const [isOpen, setIsOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [kernelOutput, setKernelOutput] = useState<string>('');
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  // Focus input when terminal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [kernelOutput]);

  // Helper function to manage the output buffer
  const appendToOutput = (newContent: string) => {
    setKernelOutput(prev => {
      const combinedOutput = prev + newContent;
      const lines = combinedOutput.split('\n');
      if (lines.length > MAX_LINES) {
        // Keep only the last MAX_LINES lines
        return lines.slice(-MAX_LINES).join('\n');
      }
      return combinedOutput;
    });
  };

  // Handle command execution
  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    // Add command to history
    setCommandHistory(prev => {
      const newHistory = [...prev, command];
      return newHistory.slice(-MAX_HISTORY);
    });
    setHistoryIndex(-1);

    // Show command in output
    appendToOutput(`\n>>> ${command}\n`);

    try {
      if (kernel && isReady) {
        const future = kernel.requestExecute({ code: command });
        future.onIOPub = handleIOPubMessage;
        await future.done;
      }
    } catch (error) {
      appendToOutput(`\x1b[31mError: ${error}\x1b[0m\n`);
    }

    setCurrentInput('');
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand(currentInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
    }
  };

  // Helper function to handle IOPub messages
  const handleIOPubMessage = (msg: any) => {
    const msgType = msg.header.msg_type;
    
    switch (msgType) {
      case 'stream':
        appendToOutput(msg.content.text);
        break;
      case 'display_data':
      case 'execute_result':
        const data = msg.content.data;
        if (data['text/plain']) {
          appendToOutput(data['text/plain'] + '\n');
        }
        if (data['text/html']) {
          appendToOutput('[HTML Output]\n');
        }
        if (data['image/png'] || data['image/jpeg']) {
          appendToOutput('[Image Output]\n');
        }
        break;
      case 'error':
        const errorText = msg.content.traceback.join('\n');
        appendToOutput(`\x1b[31m${errorText}\x1b[0m\n`);
        break;
    }
  };

  useEffect(() => {
    if (isOpen && kernel && isReady) {
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
    } else {
      setKernelOutput('');
    }
  }, [isOpen, kernel, isReady]);

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

  const handleRestart = async () => {
    try {
      setIsRestarting(true);
      await restartKernel();
      
      if (kernel && isReady) {
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
      appendToOutput(`\x1b[31mError: Failed to restart kernel: ${error}\x1b[0m\n`);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleInterrupt = async () => {
    try {
      appendToOutput('\n=== Interrupting Kernel ===\n');
      await interruptKernel();
    } catch (error) {
      console.error('Failed to interrupt kernel:', error);
      appendToOutput(`\x1b[31mError: Failed to interrupt kernel: ${error}\x1b[0m\n`);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-colors ${getStatusColor()} hover:bg-gray-50`}
        title={getStatusText()}
      >
        {getStatusIcon()}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-[480px] bg-white rounded-lg shadow-lg border border-gray-200 divide-y divide-gray-100 z-50">
          {/* Status Section */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium text-base">
                  Python {kernelInfo.pythonVersion || '...'}
                </span>
              </div>
              <div className={`flex items-center gap-2 ${getStatusColor()}`}>
                <span className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-')}`} />
                <span className="text-sm">{getStatusText()}</span>
              </div>
            </div>

            {/* Interactive Terminal */}
            <div className="mt-4 bg-gray-900 rounded-lg font-mono text-xs text-gray-100">
              {/* Output Area */}
              <pre 
                ref={outputRef}
                className="p-3 whitespace-pre-wrap h-[200px] overflow-y-auto scrollbar scrollbar-w-2 scrollbar-thumb-gray-900 scrollbar-track-gray-800"
              >
                {kernelOutput || 'Python Terminal\n'}
              </pre>
              
              {/* Input Area */}
              <div className="border-t border-gray-700 p-2 flex items-center">
                <span className="text-green-400 mr-2">{'>>>'}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-gray-100 placeholder-gray-500"
                  placeholder={isReady ? "Type command and press Enter..." : "Waiting for kernel..."}
                  disabled={!isReady || isRestarting}
                />
              </div>
            </div>
          </div>
          
          {/* Actions Section */}
          <div className="p-3 bg-gray-50 rounded-b-lg">
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
      )}
    </div>
  );
}; 
