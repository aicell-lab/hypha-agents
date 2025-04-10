import React, { useRef, useState, KeyboardEvent, useEffect } from 'react';
import { SendIcon } from './icons/SendIcon';
import { StopIcon } from './icons/StopIcon';
import { ThebeStatus } from './ThebeStatus';
import { ToolSelector } from './ToolSelector';
import { Tool } from './ToolProvider';
import { AgentSettingsPanel } from './AgentSettingsPanel';
import { AgentSettings } from '../../utils/chatCompletion';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  isTyping?: boolean;
  isThebeReady?: boolean;
  isProcessing?: boolean;
  onSelectTool?: (tool: Tool) => void;
  agentSettings?: AgentSettings;
  onSettingsChange?: (settings: AgentSettings) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  disabled = false,
  placeholder = "Type your message...",
  isTyping = false,
  isThebeReady = false,
  isProcessing = false,
  onSelectTool,
  agentSettings,
  onSettingsChange,
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex items-end gap-3 bg-white border rounded-lg p-2">
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
        <AgentSettingsPanel settings={agentSettings} onSettingsChange={onSettingsChange} className="mx-1" />
        {onSelectTool && <ToolSelector onSelectTool={onSelectTool} className="mx-1" />}
        <ThebeStatus />
        
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
  );
}; 