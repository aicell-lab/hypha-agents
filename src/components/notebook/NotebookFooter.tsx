import React from 'react';
import { ChatInput } from '../chat/ChatInput';
import { FaSpinner } from 'react-icons/fa';
import { AgentSettings } from '../../utils/chatCompletion';

interface NotebookFooterProps {
  onSendMessage: (message: string) => void;
  onStopChatCompletion: () => void;
  isProcessing: boolean;
  isThebeReady: boolean;
  thebeStatus?: any; // Use 'any' for now, or find correct type later
  isAIReady: boolean;
  initializationError: string | null;
  onShowEditAgent?: () => void;
  onShowThebeTerminal?: () => void;
  onModelSettingsChange?: () => void;
}

const NotebookFooter: React.FC<NotebookFooterProps> = ({
  onSendMessage,
  onStopChatCompletion,
  isProcessing,
  isThebeReady,
  thebeStatus,
  isAIReady,
  initializationError,
  onShowEditAgent,
  onShowThebeTerminal,
  onModelSettingsChange
}) => {
  const getPlaceholder = () => {
    if (!isAIReady) return "Initializing AI assistant...";
    if (initializationError) return "AI assistant connection failed...";
    if (isProcessing) return "AI is thinking...";
    return "Enter text or command (e.g., /code, /markdown, /clear)";
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm pt-1 px-4 pb-4 shadow-md z-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-2 text-xs text-center">
          <p className="text-gray-500">
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <FaSpinner className="animate-spin h-4 w-4" />
                AI is thinking...
              </span>
            ) : initializationError ? initializationError :
              !isAIReady ? "Initializing AI assistant..." :
                "Ask a question or use commands like /code or /markdown to add specific cell types"}
          </p>
        </div>
        <ChatInput
          onSend={onSendMessage}
          onStop={onStopChatCompletion}
          isProcessing={isProcessing}
          disabled={!isAIReady}
          isThebeReady={isThebeReady}
          thebeStatus={thebeStatus}
          placeholder={getPlaceholder()}
          onShowEditAgent={onShowEditAgent}
          onShowThebeTerminal={onShowThebeTerminal}
          onModelSettingsChange={onModelSettingsChange}
        />
      </div>
    </div>
  );
};

export default NotebookFooter;