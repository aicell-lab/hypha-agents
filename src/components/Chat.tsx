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

const generateSessionId = () => {
  const timestamp = new Date().getTime();
  const random = Math.random();
  return `${timestamp}-${random}`;
};

const FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const Chat: React.FC = () => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      content: "👋 Hi! I'm ELIA, your AI assistant. How can I help you today?"
    }
  ]);
  const [status, setStatus] = useState('Ready to chat! Type your message and press enter!');
  const [isLoading, setIsLoading] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const schemaAgents = useHyphaStore((state) => state.schemaAgents);
  const sessionId = useRef(generateSessionId());
  const [isTyping, setIsTyping] = useState(false);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isTyping) {
      scrollToBottom();
    }
  }, [chatHistory, isTyping]);

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

      const response = await schemaAgents.aask(message, {
        agent_config: {
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
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-gray-50 to-white" style={{ fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-3 px-4 flex items-center"
      >
        <motion.img 
          whileHover={{ scale: 1.1 }}
          src="https://raw.githubusercontent.com/alalulu8668/alalulu8668.github.io/master/images/elia-agent-icon2.svg"
          alt="ELIA"
          className="h-8 mr-3 drop-shadow-lg"
        />
        <span className="text-xl font-medium tracking-wide">ELIA: Your GenAI assistant</span>
      </motion.div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white/95 backdrop-blur-sm">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent p-6">
          <AnimatePresence>
            <div className="space-y-6">
              {chatHistory.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`message-container group ${msg.sender === 'user' ? 'flex justify-end' : 'flex justify-start'} items-start space-x-3`}
                >
                  {msg.sender === 'assistant' && (
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="flex-shrink-0"
                    >
                      <img 
                        src="https://raw.githubusercontent.com/alalulu8668/alalulu8668.github.io/master/images/elia-agent-icon2.svg"
                        alt="Assistant"
                        className="w-10 h-10 drop-shadow-md"
                      />
                    </motion.div>
                  )}
                  
                  <div className={`flex flex-col max-w-[80%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <motion.div 
                      whileHover={{ scale: 1.01 }}
                      className={`rounded-2xl p-4 shadow-md ${
                        msg.sender === 'user' 
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <ReactMarkdown 
                        className={`prose prose-base max-w-none ${
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
                        className="flex space-x-2 mt-2"
                      >
                        <button 
                          onClick={() => handleFeedback(index, 'like')}
                          className="text-gray-500 hover:text-green-600 transition-all duration-200 transform hover:scale-110"
                        >
                          <FaThumbsUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleFeedback(index, 'unlike')}
                          className="text-gray-500 hover:text-red-600 transition-all duration-200 transform hover:scale-110"
                        >
                          <FaThumbsDown className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-end mt-1"
                      >
                        <motion.button
                          initial={{ opacity: 0 }}
                          whileHover={{ scale: 1.1, opacity: 1 }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all duration-200 p-1"
                          onClick={() => handleDeleteMessage(index)}
                          title="Delete message"
                        >
                          <FaTrash className="w-3 h-3" />
                        </motion.button>
                      </motion.div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      className="flex-shrink-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                        <FaUser className="w-5 h-5 text-white" />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
              <div ref={messageEndRef} />
            </div>
          </AnimatePresence>
        </div>

        {/* Bottom Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-gray-200 p-6 bg-white shadow-lg"
        >
          {/* Status Message */}
          <div className="text-base text-gray-600 mb-3 italic">{status}</div>

          {/* Input Area */}
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className="w-full p-3 pr-4 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white shadow-sm transition-all duration-200 text-gray-800 placeholder-gray-500 resize-none overflow-hidden min-h-[44px]"
                style={{
                  height: '44px',
                  maxHeight: '200px'
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
              className="px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed h-[44px] flex items-center space-x-2 shadow-md transition-all duration-200 font-medium flex-shrink-0 text-base"
            >
              <FaPaperPlane className="w-4 h-4" />
              <span>Send</span>
            </motion.button>
          </div>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center text-base"
          >
            <p className="mb-2 font-medium text-gray-700">⚠️ Warning: AI Agents can make mistakes. Consider checking important information.</p>
            <p className="text-blue-700 font-semibold">ELIA: Ericsson Learning Intelligent Agents</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Chat; 