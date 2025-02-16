import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHyphaStore } from '../../store/hyphaStore';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { FaUser, FaThumbsUp, FaThumbsDown, FaSync, FaPaperPlane, FaTrash, FaCode } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import WorkerManager, { PyodideWorker } from '../../workers/worker-manager';
import OutputDisplay from '../OutputDisplay';
import { BotIcon } from './icons/BotIcon';
import { ChatInput } from './ChatInput';

interface Output {
  type: string;
  content: string;
  attrs?: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  outputs?: Output[];
}

interface ChatProps {
  agentConfig: {
    name: string;
    profile?: string;
    goal?: string;
    model?: string;
    stream?: boolean;
    instructions?: string;
  };
  welcomeMessage?: string;
  className?: string;
  showActions?: boolean;
  onPreviewChat?: () => void;
  onPublish?: () => void;
  artifactId?: string;
}

const generateSessionId = () => {
  const timestamp = new Date().getTime();
  const random = Math.random();
  return `${timestamp}-${random}`;
};

const FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';


const Chat: React.FC<ChatProps> = ({ 
  agentConfig, 
  welcomeMessage, 
  className,
  showActions,
  onPreviewChat,
  onPublish,
  artifactId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { server } = useHyphaStore();
  const [schemaAgents, setSchemaAgents] = useState<any>(null);

  // Initialize messages with welcome message
  useEffect(() => {
    if (welcomeMessage) {
      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    }
  }, [welcomeMessage]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize schema-agents
  useEffect(() => {
    const initSchemaAgents = async () => {
      if (server) {
        try {
          const service = await server.getService("schema-agents");
          setSchemaAgents(service);
        } catch (error) {
          console.error('Failed to initialize schema-agents:', error);
        }
      }
    };

    initSchemaAgents();
  }, [server]);

  const handleSendMessage = async (message: string) => {
    if (!agentConfig || !schemaAgents) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsTyping(true);

    try {
      const response = await schemaAgents.acall(message, {
        agent_config: agentConfig,
        _rkwargs: true
      });

      // Add assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your message.' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Actions Bar - Only show if showActions is true */}
      {showActions && (
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Preview</h3>
              <div className="flex gap-2">
                <button 
                  onClick={onPreviewChat}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Window
                </button>
                <button 
                  onClick={onPublish}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Chat Messages */}
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-4 p-6 ${
              message.role === 'assistant' ? 'bg-white' : 'bg-gray-50'
            }`}>
              {message.role === 'assistant' ? (
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <BotIcon className="w-5 h-5 text-purple-600" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <FaUser className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <div className="flex-1">
                <ReactMarkdown 
                  className="prose prose-sm max-w-none"
                  rehypePlugins={[rehypeRaw]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-4 p-6 bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center animate-pulse">
                <BotIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-gray-500 text-sm">Assistant is thinking...</div>
              </div>
            </div>
          )}
          
          <div ref={messageEndRef} />
        </div>
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <ChatInput 
            onSend={handleSendMessage} 
            disabled={isTyping || !schemaAgents} 
            isTyping={isTyping}
            placeholder={
              !schemaAgents 
                ? "Initializing AI service..." 
                : isTyping 
                  ? "Please wait..."
                  : "Type your message..."
            }
          />
          {!schemaAgents && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Connecting to AI service...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;