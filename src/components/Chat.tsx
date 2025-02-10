import React, { useState, useRef, useEffect } from 'react';
import { useHyphaStore } from '../store/hyphaStore';
import ReactMarkdown from 'react-markdown';
import { FaUser, FaThumbsUp, FaThumbsDown, FaSync, FaPaperPlane, FaTrash } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessage {
  sender: string;
  content: string;
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
  const messageEndRef = useRef<HTMLDivElement>(null);
  const schemaAgents = useHyphaStore((state) => state.schemaAgents);
  const sessionId = useRef(generateSessionId());
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setChatHistory([{
      sender: 'assistant',
      content: welcomeMessage || "👋 Hi! I'm ELIA, your AI assistant. How can I help you today?"
    }]);
  }, [welcomeMessage]);

  const handleFeedback = async (messageIndex: number, type: 'like' | 'unlike') => {
    const feedback = prompt('Please share your thoughts about this response, thank you!');
    if (!feedback) return;

    try {
      const feedbackData = {
        type,
        feedback,
        messages: chatHistory.slice(0, messageIndex),
        session_id: sessionId.current
      };
      
      // TODO: Implement feedback submission
      console.log('Feedback submitted:', feedbackData);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback');
    }
  };

  const handleDeleteMessage = (index: number) => {
    setChatHistory(prev => prev.slice(0, index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setIsTyping(true);
    target.style.height = '44px';
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
    setTimeout(() => setIsTyping(false), 100);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    try {
      setIsLoading(true);
      setStatus('🤔 Thinking...');

      if (!schemaAgents) {
        throw new Error('Hypha client is not initialized.');
      }

      // Add user message to chat
      setChatHistory(prev => [...prev, { sender: 'user', content: message }]);

      // Use provided agentConfig or fallback to defaults
      const response = await schemaAgents.aask(message, {
        agent_config: agentConfig || {
          name: "Alice",
          profile: "BioImage Analyst",
          goal: "A are a helpful agent",
          model: "gpt-4o-mini",
          stream: true
        },
        _rkwargs: true
      });

      // Add assistant message to chat
      setChatHistory(prev => [...prev, { sender: 'assistant', content: response }]);
      setMessage('');
      setStatus('Ready to chat! Type your message and press enter!');

    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('Error: Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white/95 backdrop-blur-sm min-h-0">
        {/* Messages Area - smaller padding */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent p-3">
          <AnimatePresence>
            <div className="space-y-3"> {/* Even less space between messages */}
              {chatHistory.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`message-container group ${msg.sender === 'user' ? 'flex justify-end' : 'flex justify-start'} items-start space-x-2`}
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
                  
                  <div className={`flex flex-col max-w-[80%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <motion.div 
                      whileHover={{ scale: 1.01 }}
                      className={`rounded-xl p-3 shadow-md ${
                        msg.sender === 'user' 
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <ReactMarkdown 
                        className={`prose prose-sm max-w-none ${
                          msg.sender === 'user' 
                            ? 'prose-invert' 
                            : 'prose-gray prose-headings:text-gray-900 prose-p:text-gray-800'
                        }`}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </motion.div>
                    
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