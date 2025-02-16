import React from 'react';
import ReactMarkdown from 'react-markdown';
import { UserIcon } from './icons/UserIcon';
import { BotIcon } from './icons/BotIcon';

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
  isLoading?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLoading }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 p-6 ${isUser ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-blue-600" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <BotIcon className="w-5 h-5 text-purple-600" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="font-medium text-sm text-gray-500">
          {isUser ? 'You' : 'Assistant'}
        </div>
        <ReactMarkdown
          className={`prose max-w-none ${isLoading ? 'opacity-60' : ''}`}
          components={{
            pre: ({ node, ...props }) => (
              <div className="overflow-auto bg-gray-900 text-gray-100 p-4 rounded-lg my-2">
                <pre {...props} />
              </div>
            ),
            code: ({ node, inline, ...props }) =>
              inline ? (
                <code className="bg-gray-100 text-gray-900 px-1 py-0.5 rounded" {...props} />
              ) : (
                <code {...props} />
              ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}; 