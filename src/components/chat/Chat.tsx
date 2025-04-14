import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useThebe } from './ThebeProvider';
import { useVoiceMode, VoiceModeProvider } from './VoiceModeProvider';
import { OutputItem } from '../../types/notebook';
import { chatCompletion, ChatMessage as ChatCompletionMessage, DefaultAgentConfig, AgentSettings } from '../../utils/chatCompletion';

export interface ContentItem {
  type: 'markdown' | 'code_execution' | 'tool_call' | 'image' | 'html' | 'input_audio';
  content: string;
  attrs?: {
    language?: string;
    output?: OutputItem[];
    status?: string;
    transcript?: string | null;
    [key: string]: any;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: ContentItem[];
}

interface ChatProps {
  agentConfig: {
    name: string;
    profile?: string;
    goal?: string;
    model?: string;
    stream?: boolean;
    disableStreaming?: boolean;
    instructions?: string;
    startup_script?: string;
    welcomeMessage?: string;
    voice?: string;
    temperature?: number;
    enabled_tools?: string[];
    mode?: 'text' | 'voice';
  };
  className?: string;
  showActions?: boolean;
  onPreviewChat?: () => void;
  onPublish?: () => void;
  artifactId?: string;
  initialMessages?: Message[];
  enableVoiceMode?: boolean;
}

const defaultInitialMessages: Message[] = [];

const ChatContent: React.FC<ChatProps> = (props) => {
  const {
    agentConfig,
    className,
    showActions = false,
    onPreviewChat,
    onPublish,
    artifactId,
    initialMessages = defaultInitialMessages,
    enableVoiceMode = false,
  } = props;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { isReady, executeCode, executeCodeWithDOMOutput } = useThebe();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const { isChatRunning, isPaused, stopChat: voiceStopChat } = useVoiceMode();

  // State for the agent settings (combining with defaults)
  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    ...DefaultAgentConfig,
    model: agentConfig.model || DefaultAgentConfig.model,
    temperature: agentConfig.temperature ?? DefaultAgentConfig.temperature
  });

  // Scroll to bottom effect
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Convert our Message format to ChatCompletionMessage format
  const convertToChatCompletionMessages = useCallback((msgs: Message[]): ChatCompletionMessage[] => {
    return msgs.map(msg => {
      const contentText = msg.content
        .map(item => item.type === 'markdown' ? item.content : '')
        .join('\n')
        .trim();
        
      return {
        role: msg.role as any,
        content: contentText
      };
    });
  }, []);

  // Execute code helper function
  const handleExecuteCode = useCallback(async (completionId: string, code: string): Promise<string> => {
    let result = '';
    
    // Create a new content item with code
    const codeContentItem: ContentItem = {
      type: 'code_execution',
      content: code,
      attrs: {
        language: 'python',
        output: [],
        status: 'running'
      }
    };
    
    // Add or update assistant message
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        return [
          ...prev.slice(0, -1),
          {
            ...lastMessage,
            content: [...lastMessage.content, codeContentItem]
          }
        ];
      } else {
        return [
          ...prev,
          {
            role: 'assistant',
            content: [codeContentItem]
          }
        ];
      }
    });
    
    try {
      // Create a hidden div for output
      const outputElement = document.createElement('div');
      outputElement.style.display = 'none';
      document.body.appendChild(outputElement);
      
      let outputs: OutputItem[] = [];
      
      // Execute with DOM output for rich content
      await executeCodeWithDOMOutput(code, outputElement, {
        onOutput: (out: { type: string; content: string; short_content?: string; attrs?: any }) => {
          const output: OutputItem = {
            type: out.type,
            content: out.content
          };
          outputs.push(output);
          
          // Update message with current outputs
          updateLastAssistantMessage(code, 'running', outputs);
        },
        onStatus: (status: string) => {
          if (status === 'Completed' && outputElement.innerHTML) {
            // Add HTML output for rich content
            const htmlOutput: OutputItem = {
              type: 'html',
              content: outputElement.innerHTML
            };
            outputs.push(htmlOutput);
            
            // Update message with final outputs
            updateLastAssistantMessage(code, 'success', outputs);
          }
        }
      });
      
      // Create a string representation of outputs for LLM
      result = outputs
        .filter(o => o.type !== 'html')
        .map(o => o.content)
        .join('\n');
      
      // Clean up the DOM element
      document.body.removeChild(outputElement);
      
      return result;
    } catch (error) {
      console.error('Error executing code:', error);
      const errorOutput: OutputItem = {
        type: 'error',
        content: error instanceof Error ? error.message : 'Error executing code'
      };
      
      // Update message with error
      updateLastAssistantMessage(code, 'error', [errorOutput]);
      
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, [executeCodeWithDOMOutput]);

  // Update the last assistant message with code output
  const updateLastAssistantMessage = useCallback((code: string, status: string, outputs: OutputItem[]) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      
      if (lastMessage && lastMessage.role === 'assistant') {
        const lastContent = [...lastMessage.content];
        
        // Find the code execution content item or add a new one
        const codeItemIndex = lastContent.findIndex(item => 
          item.type === 'code_execution' && item.content === code
        );
        
        if (codeItemIndex >= 0) {
          // Update existing code item
          lastContent[codeItemIndex] = {
            ...lastContent[codeItemIndex],
            attrs: {
              ...lastContent[codeItemIndex].attrs,
              status,
              output: outputs
            }
          };
        } else {
          // Add new code item
          lastContent.push({
            type: 'code_execution',
            content: code,
            attrs: {
              language: 'python',
              status,
              output: outputs
            }
          });
        }
        
        newMessages[newMessages.length - 1] = {
          ...lastMessage,
          content: lastContent
        };
      }
      
      return newMessages;
    });
  }, []);

  // Handle stopping the chat
  const stopChat = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    
    if (isChatRunning) {
      await voiceStopChat();
    }
  }, [isChatRunning, voiceStopChat]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (message: string) => {
    if (!isReady) {
      setError("AI assistant is not ready. Please wait.");
      return;
    }
    
    if (isProcessing) {
      console.warn('Already processing a message, ignoring new message');
      return;
    }
    
    // Add user message
    setMessages(prev => [
      ...prev, 
      {
        role: 'user',
        content: [{
          type: 'markdown',
          content: message
        }]
      }
    ]);
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Create a new abort controller for this chat
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      // Get conversation history in the right format
      const chatHistory = convertToChatCompletionMessages(messages);
      
      // Add the new user message
      chatHistory.push({
        role: 'user',
        content: message
      });
      
      // Add a temporary thinking message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: [{
            type: 'markdown',
            content: '🤔 Thinking...'
          }]
        }
      ]);
      
      // Start the chat completion
      const completion = chatCompletion({
        messages: chatHistory,
        model: agentSettings.model,
        temperature: agentSettings.temperature,
        baseURL: agentSettings.baseURL,
        apiKey: agentSettings.apiKey,
        abortController,
        onExecuteCode: handleExecuteCode,
        onStreaming: (completionId, streamContent) => {
          // Update the assistant's message with streaming content
          setMessages(prev => {
            const lastIndex = prev.length - 1;
            const lastMessage = prev[lastIndex];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              return [
                ...prev.slice(0, lastIndex),
                {
                  ...lastMessage,
                  content: [{
                    type: 'markdown',
                    content: streamContent
                  }]
                }
              ];
            }
            return prev;
          });
        }
      });
      
      // Process the completion stream
      let lastContent = '';
      
      for await (const item of completion) {
        if (item.type === 'text') {
          lastContent = item.content || '';
        }
      }
      
      // Ensure the final content is set correctly
      if (lastContent) {
        setMessages(prev => {
          const lastIndex = prev.length - 1;
          const lastMessage = prev[lastIndex];
          
          if (lastMessage && lastMessage.role === 'assistant') {
            return [
              ...prev.slice(0, lastIndex),
              {
                ...lastMessage,
                content: [{
                  type: 'markdown',
                  content: lastContent
                }]
              }
            ];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error in chat completion:', error);
      setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Show error in chat
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: [{
            type: 'markdown',
            content: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        }
      ]);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [
    isReady, 
    isProcessing, 
    messages, 
    convertToChatCompletionMessages, 
    handleExecuteCode, 
    agentSettings,
    isChatRunning
  ]);

  // return jsx components
  return (
    <div ref={chatContainerRef} className={`flex flex-col h-full overflow-hidden ${className}`}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <ChatMessageComponent
            key={index}
            message={message}
            isLoading={isProcessing && index === messages.length - 1 && message.role === 'assistant'}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isInputDisabled || isProcessing || !isReady}
          isProcessing={isProcessing}
          onStop={stopChat}
          isThebeReady={isReady}
          placeholder={error || "Type your message..."}
          agentSettings={agentSettings}
          onSettingsChange={setAgentSettings}
        />
      </div>
    </div>
  );
};

// Wrap with providers
const Chat: React.FC<ChatProps> = (props) => {
  return (
    <VoiceModeProvider>
      <ChatContent {...props} />
    </VoiceModeProvider>
  );
};

export default Chat;