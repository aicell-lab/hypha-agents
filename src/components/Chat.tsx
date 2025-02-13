import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHyphaStore } from '../store/hyphaStore';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { FaUser, FaThumbsUp, FaThumbsDown, FaSync, FaPaperPlane, FaTrash, FaCode } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import WorkerManager, { PyodideWorker } from '../workers/worker-manager';
import OutputDisplay from './OutputDisplay';

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

interface ChatMessage {
  sender: string;
  content: string;
  outputs?: Output[];
}

interface ChatProps {
  agentConfig?: {
    name: string;
    profile?: string;
    goal?: string;
    model?: string;
    [key: string]: any;
  };
  welcomeMessage?: string;
  className?: string;
}

const generateSessionId = () => {
  const timestamp = new Date().getTime();
  const random = Math.random();
  return `${timestamp}-${random}`;
};

const FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';


const Chat: React.FC<ChatProps> = ({ agentConfig, welcomeMessage, className }) => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      content: welcomeMessage || "👋 Hi! I'm ELIA, your AI assistant. How can I help you today?"
    }
  ]);
  const [status, setStatus] = useState('Ready to chat! Type your message and press enter!');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { client, server } = useHyphaStore();
  const sessionId = useRef(generateSessionId());
  const [isTyping, setIsTyping] = useState(false);
  const workerManager = useRef<WorkerManager>(WorkerManager.getInstance());
  const worker = useRef<PyodideWorker | null>(null);
  const [serviceId, setServiceId] = useState<string>('');
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [schemaAgents, setSchemaAgents] = useState<any>(null);
  
  // Add effect to initialize schemaAgents
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


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = '36px';
    target.style.height = `${target.scrollHeight}px`;
  };
  const handleExecuteCode = async () => {
    if (!message.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setStatus('⚙️ Executing code...');
      setError(null);

      // Initialize worker if not already done
      if (!worker.current) {
        worker.current = await workerManager.current.createWorker();
        setIsWorkerReady(true);
      }

      // Execute the code
      const result = await worker.current.runCode(message);

      // Add the code execution result to chat history
      setChatHistory(prev => [
        ...prev,
        { sender: 'user', content: message },
        { 
          sender: 'assistant', 
          content: 'Code execution result:',
          outputs: [{
            type: 'code',
            content: result,
            attrs: { language: 'python' }
          }]
        }
      ]);

      setMessage('');
      setStatus('Code executed successfully!');

    } catch (error) {
      console.error('Error executing code:', error);
      setError('Failed to execute code. Please check your code and try again.');
      setStatus('Error: Code execution failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setStatus('🤔 Thinking...');
      setError(null);

      if (!schemaAgents) {
        setError('The AI service is currently unavailable. Please try again later or contact support if the issue persists.');
        throw new Error('Schema-agents service is not initialized.');
      }

      // Add user message to chat
      setChatHistory(prev => [...prev, { sender: 'user', content: message }]);

      // Use provided agentConfig or fallback to defaults
      const response = await schemaAgents.acall(message, {
        agent_config: agentConfig || {
          name: "Alice",
          profile: "Help Assistant",
          goal: "I am a helpful agent",
          model: "gpt-4o-mini",
          stream: true,
          services: []
        },
        _rkwargs: true
      });

      // Add assistant message to chat
      setChatHistory(prev => [...prev, { sender: 'assistant', content: response }]);
      setMessage('');
      setStatus('Ready to chat! Type your message and press enter!');

    } catch (error) {
      console.error('Error sending message:', error);
      if (!error) {
        setError('Failed to send message. Please try again.');
      }
      setStatus('Error: Please check the error message above.');
    } finally {
      setIsLoading(false);
    }
  };

  // Custom component for rendering markdown with outputs
  const MarkdownWithOutputs: React.FC<{ 
    content: string; 
    outputs?: Output[]; 
    isUser?: boolean 
  }> = React.memo(({ content, outputs, isUser }) => {
    return (
      <div className="flex flex-col gap-2 w-full">
        <ReactMarkdown 
          className={`prose prose-sm max-w-none ${
            isUser 
              ? 'prose-invert' 
              : 'prose-gray prose-headings:text-gray-900 prose-p:text-gray-800'
          }`}
          rehypePlugins={[rehypeRaw]}
        >
          {content}
        </ReactMarkdown>
        {outputs && outputs.length > 0 && (
          <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 w-full">
            <OutputDisplay 
              outputs={outputs}
              theme={isUser ? 'dark' : 'light'}
            />
          </div>
        )}
      </div>
    );
  });

  return (
    <div className={`flex flex-col h-full bg-gradient-to-b from-gray-50 to-white ${className || ''}`} style={{ fontFamily: FONT_FAMILY }}>
      {/* Header - even smaller */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-1.5 px-3 flex items-center flex-shrink-0"
      >
        <motion.img 
          whileHover={{ scale: 1.1 }}
          src="https://raw.githubusercontent.com/alalulu8668/alalulu8668.github.io/master/images/elia-agent-icon2.svg"
          alt="ELIA"
          className="h-6 mr-2 drop-shadow-lg"
        />
        <span className="text-base font-medium tracking-wide">ELIA: Your GenAI assistant</span>
      </motion.div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white/95 backdrop-blur-sm min-h-0">
        {/* Messages Area - smaller padding */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent p-3">
          <AnimatePresence>
            <div className="space-y-3"> {/* Even less space between messages */}
              {chatHistory.map((msg, index) => (
                <motion.div
                  key={`msg-${index}-${msg.content.substring(0, 20)}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`message-container group ${msg.sender === 'user' ? 'flex justify-end' : 'flex justify-start'} items-start space-x-2 w-full`}
                >
                  {msg.sender === 'assistant' && (
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="flex-shrink-0"
                    >
                      <img 
                        src="https://raw.githubusercontent.com/alalulu8668/alalulu8668.github.io/master/images/elia-agent-icon2.svg"
                        alt="Assistant"
                        className="w-8 h-8 drop-shadow-md" // Smaller avatar
                      />
                    </motion.div>
                  )}
                  
                  <div className={`flex flex-col w-[80%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100'} rounded-lg px-4 py-2 max-w-full break-words shadow-sm`}>
                      <MarkdownWithOutputs 
                        key={`outputs-${index}`}
                        content={msg.content}
                        outputs={msg.outputs}
                        isUser={msg.sender === 'user'}
                      />
                    </div>
                    {msg.sender === 'assistant' ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex space-x-2 mt-1"
                      >
                        <button 
                          onClick={() => handleFeedback(index, 'like')}
                          className="text-gray-500 hover:text-green-600 transition-all duration-200 transform hover:scale-110"
                        >
                          <FaThumbsUp className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleFeedback(index, 'unlike')}
                          className="text-gray-500 hover:text-red-600 transition-all duration-200 transform hover:scale-110"
                        >
                          <FaThumbsDown className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-end mt-0.5"
                      >
                        <motion.button
                          initial={{ opacity: 0 }}
                          whileHover={{ scale: 1.1, opacity: 1 }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all duration-200 p-0.5"
                          onClick={() => handleDeleteMessage(index)}
                          title="Delete message"
                        >
                          <FaTrash className="w-2.5 h-2.5" />
                        </motion.button>
                      </motion.div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="flex-shrink-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                        <FaUser className="w-4 h-4 text-white" />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
              <div ref={messageEndRef} />
            </div>
          </AnimatePresence>
        </div>

        {/* Bottom Section - more compact */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-gray-200 p-2 bg-white shadow-lg flex-shrink-0"
        >
          {/* Status Message - smaller */}
          <div className="text-xs text-gray-600 mb-1.5 italic">{status}</div>

          {/* Input Area */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className="w-full p-2 pr-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white shadow-sm transition-all duration-200 text-gray-800 placeholder-gray-500 resize-none overflow-hidden min-h-[36px]"
                style={{
                  height: '36px',
                  maxHeight: '120px'
                }}
                onInput={handleInput}
                disabled={isLoading}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExecuteCode}
              disabled={isLoading || !isWorkerReady}
              className="px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed h-[36px] flex items-center space-x-1.5 shadow-md transition-all duration-200 font-medium flex-shrink-0 text-xs"
              title={isWorkerReady ? "Execute code" : "Initializing code runner..."}
            >
              <FaCode className="w-3 h-3" />
              <span>Run</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendMessage}
              disabled={isLoading}
              className="px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed h-[36px] flex items-center space-x-1.5 shadow-md transition-all duration-200 font-medium flex-shrink-0 text-xs"
            >
              <FaPaperPlane className="w-3 h-3" />
              <span>Send</span>
            </motion.button>
          </div>

          {/* Footer - more compact */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-center text-xs"
          >
            <p className="mb-0.5 font-medium text-gray-700">⚠️ AI Agents can make mistakes. Check important information.</p>
            <p className="text-blue-700 font-semibold">ELIA: Ericsson Learning Intelligent Agents</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Chat;