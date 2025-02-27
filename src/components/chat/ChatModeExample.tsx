import React, { useState, useEffect } from 'react';
import { useVoiceMode } from './VoiceModeProvider';
import { useTextMode } from './TextModeProvider';
import { useTools } from './ToolProvider';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: {
    type: string;
    text: string;
  }[];
}

interface FunctionCall {
  name: string;
  arguments: any;
  call_id: string;
}

interface FunctionOutput {
  call_id: string;
  output: string;
}

type ChatItem = ChatMessage | FunctionCall | FunctionOutput;

const ChatModeExample: React.FC = () => {
  const [mode, setMode] = useState<'voice' | 'text'>('text');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isActive, setIsActive] = useState(false);
  
  // Get the appropriate mode provider based on the selected mode
  const voiceMode = useVoiceMode();
  const textMode = useTextMode();
  const { tools } = useTools();
  
  // Get the current mode provider
  const currentMode = mode === 'voice' ? voiceMode : textMode;
  
  // Handle chat item creation
  const handleItemCreated = (item: any) => {
    setMessages(prev => [...prev, item]);
  };
  
  // Start chat session
  const startChat = async () => {
    try {
      await currentMode.startChat({
        onItemCreated: handleItemCreated,
        instructions: "You are a helpful assistant. Answer questions concisely and accurately.",
        temperature: 0.7,
        tools: tools,
      });
      setIsActive(true);
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };
  
  // Stop chat session
  const stopChat = async () => {
    try {
      await currentMode.stopChat();
      setIsActive(false);
    } catch (error) {
      console.error('Failed to stop chat:', error);
    }
  };
  
  // Toggle between voice and text modes
  const toggleMode = async () => {
    if (isActive) {
      await currentMode.stopChat();
    }
    
    setMode(prev => prev === 'voice' ? 'text' : 'voice');
    setIsActive(false);
  };
  
  // Send a message
  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    currentMode.sendText(inputText);
    setInputText('');
  };
  
  // Render chat messages
  const renderChatItem = (item: ChatItem, index: number) => {
    if ('type' in item) {
      if (item.type === 'message') {
        const message = item as ChatMessage;
        return (
          <div key={index} className={`p-3 rounded mb-2 ${message.role === 'user' ? 'bg-blue-100 ml-12' : 'bg-gray-100 mr-12'}`}>
            {message.content.map((content, i) => (
              <div key={i}>{content.text}</div>
            ))}
          </div>
        );
      } else if (item.type === 'function_call') {
        const functionCall = item as FunctionCall;
        return (
          <div key={index} className="p-3 rounded mb-2 bg-yellow-100">
            <div className="font-bold">Function Call: {functionCall.name}</div>
            <pre className="text-xs overflow-auto">{JSON.stringify(functionCall.arguments, null, 2)}</pre>
          </div>
        );
      } else if (item.type === 'function_call_output') {
        const output = item as FunctionOutput;
        return (
          <div key={index} className="p-3 rounded mb-2 bg-green-100">
            <div className="font-bold">Function Output:</div>
            <pre className="text-xs overflow-auto">{output.output}</pre>
          </div>
        );
      }
    }
    
    return (
      <div key={index} className="p-3 rounded mb-2 bg-gray-100">
        <pre className="text-xs overflow-auto">{JSON.stringify(item, null, 2)}</pre>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">Chat Example</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="mr-2">Mode:</span>
            <button
              onClick={toggleMode}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
              disabled={isActive}
            >
              {mode === 'voice' ? 'Voice' : 'Text'}
            </button>
          </div>
          
          <div className="flex items-center">
            <span className="mr-2">Status:</span>
            <span className={`px-2 py-1 rounded ${isActive ? 'bg-green-100' : 'bg-red-100'}`}>
              {isActive ? currentMode.status : 'Inactive'}
            </span>
          </div>
          
          <button
            onClick={isActive ? stopChat : startChat}
            className={`px-3 py-1 rounded ${isActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
          >
            {isActive ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(renderChatItem)}
      </div>
      
      <div className="border-t p-4">
        <div className="flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded mr-2"
            disabled={!isActive}
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!isActive || !inputText.trim()}
          >
            Send
          </button>
        </div>
        
        {mode === 'voice' && (
          <div className="mt-2 flex justify-center">
            <button
              onClick={voiceMode.isPaused ? voiceMode.resumeChat : voiceMode.pauseChat}
              className={`px-4 py-2 rounded ${voiceMode.isPaused ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}
              disabled={!isActive}
            >
              {voiceMode.isPaused ? 'Resume Microphone' : 'Pause Microphone'}
            </button>
          </div>
        )}
        
        {currentMode.error && (
          <div className="mt-2 p-2 bg-red-100 text-red-800 rounded">
            Error: {currentMode.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatModeExample; 