import React, { useRef, useState, KeyboardEvent, useEffect } from 'react';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { ToolSelector } from './ToolSelector';
import { Tool } from './ToolProvider';
import { RiRobot2Line } from 'react-icons/ri';
import { FaCircle, FaSpinner, FaExclamationTriangle, FaCode, FaAt } from 'react-icons/fa';
import { AgentSettings } from '../../utils/chatCompletion';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  isTyping?: boolean;
  isThebeReady?: boolean;
  thebeStatus?: any;
  isProcessing?: boolean;
  onSelectTool?: (tool: Tool) => void;
  onShowEditAgent?: () => void;
  onShowThebeTerminal?: () => void;
  onModelSettingsChange?: () => void;
}

interface FileMention {
  id: string;
  name: string;
}

// Sample file list for demonstration
const SAMPLE_FILES = [
  { id: '1', name: 'pyodide-worker.js' },
  { id: '2', name: 'WelcomeScreen.tsx' },
  { id: '3', name: 'ChatInput.tsx' },
  { id: '4', name: 'index.ts' },
  { id: '5', name: 'config.json' },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  disabled = false,
  placeholder = "Type your message...",
  isTyping = false,
  isThebeReady = false,
  thebeStatus = 'idle',
  isProcessing = false,
  onSelectTool,
  onShowEditAgent,
  onShowThebeTerminal,
  onModelSettingsChange,
}) => {
  const [message, setMessage] = useState('');
  const [mentionedFiles, setMentionedFiles] = useState<FileMention[]>([]);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!isTyping && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isTyping]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      // You could modify this to include file references in the message
      onSend(message);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    }
  };

  const handleStop = () => {
    if (onStop) {
      onStop();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleMentionFile = () => {
    setShowFileDropdown(!showFileDropdown);
  };

  const handleSelectFile = (file: FileMention) => {
    // Only add if not already mentioned
    if (!mentionedFiles.some(f => f.id === file.id)) {
      setMentionedFiles([...mentionedFiles, file]);
    }
    setShowFileDropdown(false);
  };

  const handleRemoveFile = (fileId: string) => {
    setMentionedFiles(mentionedFiles.filter(file => file.id !== fileId));
  };

  const getStatusIndicator = () => {
    if (!isThebeReady) {
      return {
        color: 'text-gray-400',
        icon: <FaSpinner className="w-4 h-4 animate-spin" />,
        text: 'Initializing Kernel...'
      };
    }
    switch (thebeStatus) {
      case 'busy':
        return {
          color: 'text-yellow-500',
          icon: <FaSpinner className="w-4 h-4 animate-spin" />,
          text: 'Kernel Busy'
        };
      case 'error':
        return {
          color: 'text-red-500',
          icon: <FaExclamationTriangle className="w-4 h-4" />,
          text: 'Kernel Error'
        };
      case 'idle':
      default:
        return {
          color: 'text-green-500',
          icon: <FaCircle className="w-3 h-3" />,
          text: 'Kernel Ready'
        };
    }
  };

  const { color: statusColor, icon: statusIcon, text: statusText } = getStatusIndicator();

  return (
    <div className="flex flex-col bg-white border rounded-lg">
      {mentionedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border-b">
          {mentionedFiles.map(file => (
            <div 
              key={file.id} 
              className="flex items-center gap-1 bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded-md"
            >
              <span className="flex items-center">
                <FaAt className="w-3 h-3 mr-1 text-gray-500" />
                {file.name}
              </span>
              <button
                onClick={() => handleRemoveFile(file.id)}
                className="ml-1 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-end gap-3 p-2">
        <div className="relative">
          <button
            onClick={handleMentionFile}
            className="p-2 mr-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            title="Mention a file"
          >
            <FaAt className="w-4 h-4" />
          </button>
          
          {showFileDropdown && (
            <div 
              ref={dropdownRef}
              className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
            >
              <div className="p-2 text-sm font-medium text-gray-700 border-b">
                Select a file
              </div>
              <div className="max-h-60 overflow-y-auto">
                {SAMPLE_FILES.map(file => (
                  <div
                    key={file.id}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-sm"
                    onClick={() => handleSelectFile(file)}
                  >
                    <FaAt className="w-3 h-3 mr-2 text-gray-500" />
                    {file.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || isProcessing}
          className="flex-1 resize-none overflow-hidden max-h-[200px] focus:outline-none focus:ring-0 border-0 bg-transparent p-2"
          style={{ height: '36px' }}
        />
        <div className="flex items-center gap-2">
          {onModelSettingsChange && (
            <button
              onClick={onModelSettingsChange}
              className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition"
              title="Edit agent configuration"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {onShowEditAgent && (
            <button
              onClick={onShowEditAgent}
              className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Edit agent configuration"
            >
              <RiRobot2Line className="w-5 h-5" />
            </button>
          )}
          {onSelectTool && <ToolSelector onSelectTool={onSelectTool} className="mx-1" />}

          {onShowThebeTerminal && (
            <button
              onClick={onShowThebeTerminal}
              className={`p-2 rounded-lg transition-colors ${statusColor} hover:bg-gray-100 flex items-center gap-1`}
              title={statusText}
              disabled={disabled}
            >
              {statusIcon}
              <FaCode className="w-4 h-4 ml-1 opacity-70" />
            </button>
          )}

          {isProcessing ? (
            <button
              onClick={handleStop}
              disabled={!onStop}
              className={`p-2 rounded-lg transition-colors ${
                !onStop
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-red-600 hover:bg-red-50'
              }`}
              title="Stop generation"
              aria-label="Stop generation"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              className={`p-2 rounded-lg transition-colors ${
                !message.trim() || disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
              title="Send message"
              aria-label="Send message"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};