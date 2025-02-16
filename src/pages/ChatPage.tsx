import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHyphaStore } from '../store/hyphaStore';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { BotIcon } from '../components/chat/icons/BotIcon';

interface AgentConfig {
  name: string;
  profile?: string;
  goal?: string;
  model?: string;
  stream?: boolean;
  instructions?: string;
}

interface ArtifactManifest {
  name: string;
  description: string;
  agent_config: AgentConfig;
  welcomeMessage?: string;
}

const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { artifactManager, isLoggedIn, server } = useHyphaStore();
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [schemaAgents, setSchemaAgents] = useState<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initSchemaAgents = async () => {
      if (server) {
        try {
          const service = await server.getService("schema-agents");
          setSchemaAgents(service);
        } catch (error) {
          console.error('Failed to initialize schema-agents:', error);
          setError('Failed to initialize AI service. Please try again later.');
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

  useEffect(() => {
    const loadAgentConfig = async () => {
      if (!artifactManager || !id) return;

      try {
        setLoading(true);
        const artifact = await artifactManager.read({
          artifact_id: `elia-platform/${id}`,
          _rkwargs: true
        });
        const manifest = artifact.manifest as ArtifactManifest;

        if (manifest.agent_config) {
          // Merge manifest data into agent config
          const config: AgentConfig = {
            name: manifest.name,
            profile: manifest.agent_config.profile || 'AI Assistant',
            goal: manifest.agent_config.goal || manifest.description,
            model: manifest.agent_config.model || 'gpt-4o-mini',
            stream: manifest.agent_config.stream ?? true,
            instructions: manifest.agent_config.instructions || manifest.description
          };
          setAgentConfig(config);
          
          // Add welcome message to messages if it exists
          if (manifest.welcomeMessage) {
            setMessages([{ role: 'assistant', content: manifest.welcomeMessage }]);
          }
        } else {
          setError('This resource is not configured as an agent');
          setTimeout(() => navigate('/'), 3000);
        }
      } catch (err) {
        console.error('Error loading agent config:', err);
        setError('Failed to load agent configuration');
      } finally {
        setLoading(false);
      }
    };

    loadAgentConfig();
  }, [artifactManager, id, navigate]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">Please log in to chat with agents</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading agent configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#F3F4F6]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/my-agents')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-md">
            <span className="text-white text-lg font-medium">
              {agentConfig?.name?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-medium text-gray-900">
              {agentConfig?.name || 'AI Assistant'}
            </h1>
            <p className="text-sm text-gray-500">
              {agentConfig?.profile || 'Ready to help'}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Messages - Use flex-1 and min-h-0 to allow scrolling */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* System Message */}
          {welcomeMessage && (
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 my-4 mx-4">
              <p className="text-sm text-blue-700">{welcomeMessage}</p>
            </div>
          )}
          
          {/* Chat Messages */}
          {messages.map((message, index) => (
            <ChatMessage 
              key={index} 
              message={message} 
              isLoading={message.role === 'assistant' && isTyping && index === messages.length - 1}
            />
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
          
          <div ref={messagesEndRef} className="h-32" />
        </div>
      </div>

      {/* Chat Input - Use flex-shrink-0 to prevent shrinking */}
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

export default ChatPage; 