import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useHyphaStore } from '../../store/hyphaStore';
import { Tool } from './ToolProvider';
import OpenAI from 'openai';

interface TextModeContextType {
  isChatRunning: boolean;
  isPaused: boolean;
  startChat: (config: {
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    tools?: Tool[];
    model?: string;
    disableStreaming?: boolean;
    chatHistory?: Array<{role: string; content: string;}>;
  }) => Promise<void>;
  stopChat: () => Promise<void>;
  pauseChat: () => Promise<void>;
  resumeChat: () => Promise<void>;
  error: string | null;
  sendText: (text: string) => void;
  status: string;
  connectionState: string;
  streamingText: string | null;
}

const TextModeContext = createContext<TextModeContextType | undefined>(undefined);

export const useTextMode = () => {
  const context = useContext(TextModeContext);
  if (!context) {
    throw new Error('useTextMode must be used within a TextModeProvider');
  }
  return context;
};

interface TextModeProviderProps {
  children: React.ReactNode;
}

interface OpenAISession {
  client_secret: {
    value: string;
  };
}

export const TextModeProvider: React.FC<TextModeProviderProps> = ({ children }) => {
  const [isChatRunning, setisChatRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const { server } = useHyphaStore();
  
  // OpenAI client reference
  const openaiClientRef = useRef<OpenAI | null>(null);
  
  // Chat session configuration
  const chatConfigRef = useRef<{
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    tools?: Tool[];
    apiKey?: string;
    messages: any[];
    model?: string;
    disableStreaming?: boolean;
  }>({
    messages: []
  });
  
  // Connection lock to prevent multiple simultaneous connection attempts
  const connectionLockRef = useRef<boolean>(false);

  // Format tools for OpenAI function calling format
  const formatToolsForOpenAI = useCallback((tools?: Tool[]) => {
    if (!tools || tools.length === 0) return [];
    
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }, []);

  // Process the OpenAI response
  const processResponse = useCallback(async (response: OpenAI.Chat.ChatCompletion) => {
    try {
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('Invalid response from OpenAI');
      }
      
      const choice = response.choices[0];
      const message = choice.message;
      
      // Handle function calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        setStatus('Executing function...');
        
        // Ensure all tool calls have the required 'type' field
        message.tool_calls = message.tool_calls.map((toolCall: any) => ({
          ...toolCall,
          type: toolCall.type || 'function'
        }));
        
        // Add assistant message to the conversation
        chatConfigRef.current.messages.push(message);
        
        // Process each tool call
        for (const toolCall of message.tool_calls) {
          const { function: functionCall } = toolCall;
          const tool = chatConfigRef.current.tools?.find(t => t.name === functionCall.name);
          
          if (tool?.fn) {
            try {
              const args = JSON.parse(functionCall.arguments);
              const result = await tool.fn(args);
              
              // Create function result message
              const functionResultMessage = {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: typeof result === 'string' ? result : JSON.stringify(result)
              };
              
              // Add function result to messages
              chatConfigRef.current.messages.push(functionResultMessage);
              
              // Create a message item for the UI
              const functionCallItem = {
                type: 'function_call',
                name: functionCall.name,
                arguments: args,
                call_id: toolCall.id
              };
              
              const functionOutputItem = {
                type: 'function_call_output',
                call_id: toolCall.id,
                output: typeof result === 'string' ? result : JSON.stringify(result)
              };
              
              // Notify about function call and result
              chatConfigRef.current.onItemCreated?.(functionCallItem);
              chatConfigRef.current.onItemCreated?.(functionOutputItem);
            } catch (error) {
              console.error('Error executing function:', error);
              
              // Create error message
              const errorMessage = {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: ${error instanceof Error ? error.message : String(error)}`
              };
              
              // Add error message to conversation
              chatConfigRef.current.messages.push(errorMessage);
              
              // Create error item for UI
              const errorItem = {
                type: 'function_call_output',
                call_id: toolCall.id,
                output: `Error executing code: ${error instanceof Error ? error.stack || error.message : String(error)}`
              };
              
              chatConfigRef.current.onItemCreated?.(errorItem);
            }
          }
        }
        
        // Continue the conversation with function results
        await continueConversation();
      } else if (message.content) {
        // Regular text response
        chatConfigRef.current.messages.push(message);
        
        // Create a message item for the UI
        const textMessage = {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: message.content
            }
          ]
        };
        
        chatConfigRef.current.onItemCreated?.(textMessage);
        setStatus('Response received');
      }
      
      // Clear streaming text when processing is complete
      setStreamingText(null);
    } catch (error) {
      console.error('Error processing response:', error);
      setError(`Error processing response: ${error instanceof Error ? error.message : String(error)}`);
      setStatus('Error processing response');
      setStreamingText(null); // Clear streaming text on error
    }
  }, []);

  const continueConversation = useCallback(async () => {
    try {
      setStatus('Assistant is thinking...');
      
      // Ensure OpenAI client is initialized
      if (!openaiClientRef.current || !chatConfigRef.current.apiKey) {
        throw new Error('OpenAI client not initialized');
      }
      
      // Check if streaming is disabled
      if (chatConfigRef.current.disableStreaming) {
        // Use non-streaming API
        const response = await openaiClientRef.current.chat.completions.create({
          model: chatConfigRef.current.model || 'gpt-4o-mini',
          messages: chatConfigRef.current.messages,
          tools: formatToolsForOpenAI(chatConfigRef.current.tools),
          tool_choice: 'auto',
          temperature: chatConfigRef.current.temperature || 0.7,
          stream: false
        });
        
        await processResponse(response);
        return;
      }
      
      // Use streaming API
      const stream = await openaiClientRef.current.chat.completions.create({
        model: chatConfigRef.current.model || 'gpt-4o-mini',
        messages: chatConfigRef.current.messages,
        tools: formatToolsForOpenAI(chatConfigRef.current.tools),
        tool_choice: 'auto',
        temperature: chatConfigRef.current.temperature || 0.7,
        stream: true // Enable streaming
      });
      
      // Initialize streaming text
      setStreamingText('');
      
      // Process the stream
      let fullResponse = '';
      let fullMessage: any = null;
      
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        
        // Handle tool calls
        if (choice?.delta?.tool_calls) {
          // If we get a tool call, we'll handle it after the stream completes
          if (!fullMessage) {
            fullMessage = {
              role: 'assistant',
              content: '',
              tool_calls: []
            };
          }
          
          // Update tool calls
          if (choice.delta.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {
              // Ensure fullMessage and tool_calls array exists
              if (!fullMessage) {
                fullMessage = {
                  role: 'assistant',
                  content: '',
                  tool_calls: []
                };
              }
              if (!fullMessage.tool_calls) {
                fullMessage.tool_calls = [];
              }
              
              const existingToolCall = toolCall.index !== undefined ? 
                fullMessage.tool_calls.find((tc: any) => tc.index === toolCall.index) : 
                undefined;
              
              if (existingToolCall) {
                // Update existing tool call
                if (toolCall.function?.name) {
                  existingToolCall.function.name = (existingToolCall.function.name || '') + toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  existingToolCall.function.arguments = (existingToolCall.function.arguments || '') + toolCall.function.arguments;
                }
                if (toolCall.id) {
                  existingToolCall.id = toolCall.id;
                }
                if (toolCall.type) {
                  existingToolCall.type = toolCall.type;
                } else if (!existingToolCall.type) {
                  existingToolCall.type = 'function';
                }
              } else if (toolCall.index !== undefined) {
                // Add new tool call
                fullMessage.tool_calls.push({
                  index: toolCall.index,
                  id: toolCall.id || '',
                  type: 'function',
                  function: {
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || ''
                  }
                });
              }
            }
          }
          
          // Update streaming text to show tool call is being prepared
          // Get unique tool names from the current tool calls
          const toolNames = fullMessage.tool_calls
            .map((tc: any) => tc.function?.name)
            .filter((name: string | undefined) => name && name.trim() !== '')
            .filter((name: string, index: number, self: string[]) => 
              self.indexOf(name) === index
            );
          
          // Create a formatted list of tools with emojis
          if (toolNames.length > 0) {
            const toolList = toolNames.map((name: string) => `🔧 ${name}`).join('\n');
            setStreamingText(`Calling tools:\n${toolList}`);
          } else {
            setStreamingText(`Preparing to call tools... 🔧`);
          }
        } 
        // Handle regular text content
        else if (choice?.delta?.content) {
          fullResponse += choice.delta.content;
          setStreamingText(fullResponse);
          
          if (!fullMessage) {
            fullMessage = {
              role: 'assistant',
              content: fullResponse
            };
          } else {
            fullMessage.content = fullResponse;
          }
        }
      }
      
      // Process the complete message
      if (fullMessage) {
        // Ensure all tool calls have the required 'type' field
        if (fullMessage.tool_calls && fullMessage.tool_calls.length > 0) {
          fullMessage.tool_calls = fullMessage.tool_calls.map((toolCall: any) => ({
            ...toolCall,
            type: toolCall.type || 'function'
          }));
        }
        
        await processResponse({
          id: 'streaming-response',
          choices: [{ 
            message: fullMessage, 
            index: 0, 
            finish_reason: 'stop',
            logprobs: null
          }],
          created: Date.now(),
          model: chatConfigRef.current.model || 'gpt-4o-mini',
          object: 'chat.completion'
        } as OpenAI.Chat.ChatCompletion);
      }
      
    } catch (error) {
      console.error('Error continuing conversation:', error);
      setError(`Error continuing conversation: ${error instanceof Error ? error.message : String(error)}`);
      setStatus('Error continuing conversation');
      setStreamingText(null); // Clear streaming text on error
    }
  }, [formatToolsForOpenAI, processResponse]);

  const stopChat = useCallback(async () => {
    try {
      setStatus('Stopping...');
      setIsPaused(false);
      setConnectionState('disconnected');
      
      // Clear chat configuration
      chatConfigRef.current = {
        messages: []
      };
      
      // Clear OpenAI client
      openaiClientRef.current = null;
      
      // Clear streaming text
      setStreamingText(null);
      
      setisChatRunning(false);
      setStatus('Stopped');
      
      // Release the connection lock to allow new connections
      connectionLockRef.current = false;
    } catch (err) {
      console.error('Error stopping chat:', err);
      setError('Failed to stop chat properly');
      setStatus('Error stopping');
      
      // Force reset even if errors occurred
      setisChatRunning(false);
      setStreamingText(null);
      
      // Release the connection lock even on error
      connectionLockRef.current = false;
    }
  }, []);

  const startChat = useCallback(async (config: {
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    tools?: Tool[];
    model?: string;
    disableStreaming?: boolean;
    chatHistory?: Array<{role: string; content: string;}>;
  }) => {
    // Declare and initialize timeout variable at the top of the function
    let lockTimeout: ReturnType<typeof setTimeout> | null = null;
    
    try {
      // Check if a connection attempt is already in progress
      if (connectionLockRef.current) {
        console.log('Connection attempt already in progress, ignoring this request');
        return;
      }
      
      // Set the connection lock
      connectionLockRef.current = true;
      
      // Set a timeout to release the lock if the connection attempt takes too long
      lockTimeout = setTimeout(() => {
        if (connectionLockRef.current) {
          console.log('Connection attempt timed out, releasing lock');
          connectionLockRef.current = false;
        }
      }, 30000); // 30 seconds timeout
      
      // Check if there's an existing chat session and close it first
      if (isChatRunning) {
        console.log('Existing chat session detected, closing it before starting a new one');
        await stopChat();
        // Small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Store callbacks in ref for use in message handler
      chatConfigRef.current = {
        ...config,
        messages: [],
        model: config.model || 'gpt-4o-mini',
        disableStreaming: config.disableStreaming
      };

      setStatus('Initializing...');
      console.log('======> Initializing chat with config:', config);
      console.log('======> Server:', server);
      console.log('======> available tools:', config.tools || []);
      
      // Get OpenAI API key from schema-agents service
      const schemaAgents = await server?.getService("schema-agents");
      const session: OpenAISession = await schemaAgents?.get_openai_token();
      const API_KEY = session.client_secret.value;
      
      // Store API key in config
      chatConfigRef.current.apiKey = API_KEY;
      
      // Initialize OpenAI client
      openaiClientRef.current = new OpenAI({
        apiKey: API_KEY,
        dangerouslyAllowBrowser: true // Required for browser usage
      });
      
      // Add system message with instructions
      chatConfigRef.current.messages.push({
        role: 'system',
        content: config.instructions || 'You are a helpful assistant.'
      });

      // Add chat history if provided
      if (config.chatHistory && config.chatHistory.length > 0) {
        chatConfigRef.current.messages.push(...config.chatHistory);
        
        // Create UI items for chat history
        for (const msg of config.chatHistory) {
          const messageItem = {
            type: 'message',
            role: msg.role,
            content: [
              {
                type: 'text',
                text: msg.content
              }
            ]
          };
          config.onItemCreated?.(messageItem);
        }
      }

      setisChatRunning(true);
      setError(null);
      setStatus('Ready');
      setConnectionState('connected');
      
      // Clear the timeout and release the connection lock
      if (lockTimeout) {
        clearTimeout(lockTimeout);
      }
      connectionLockRef.current = false;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start chat');
      console.error('Chat error:', err);
      setStatus('Failed to connect');
      setConnectionState('failed');
      await stopChat();
      
      // Clear the timeout and release the connection lock
      if (lockTimeout) {
        clearTimeout(lockTimeout);
      }
      connectionLockRef.current = false;
    }
  }, [server, stopChat]);

  const pauseChat = useCallback(async () => {
    try {
      setIsPaused(true);
      setStatus('Paused');
    } catch (err) {
      console.error('Error pausing chat:', err);
      setError('Failed to pause chat');
    }
  }, []);

  const resumeChat = useCallback(async () => {
    try {
      setIsPaused(false);
      setStatus('Chat resumed');
    } catch (err) {
      console.error('Error resuming chat:', err);
      setError('Failed to resume chat');
    }
  }, []);

  // Send text message
  const sendText = useCallback(async (text: string) => {
    try {
      if (!isChatRunning) {
        throw new Error('Chat not started');
      }
      
      setStatus('Sending message...');
      
      // Create user message
      const userMessage = {
        role: 'user',
        content: text
      };
      
      // Add to messages array
      chatConfigRef.current.messages.push(userMessage);
      
      // Create a message item for the UI
      const messageItem = {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'text',
            text
          }
        ]
      };
      
      // Notify about the new message
      chatConfigRef.current.onItemCreated?.(messageItem);
      
      // Get response from OpenAI
      await continueConversation();
      
    } catch (err) {
      console.error('Error sending text:', err);
      setError(`Failed to send message: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('Error sending message');
      setStreamingText(null); // Clear streaming text on error
    }
  }, [isChatRunning, continueConversation]);


  return (
    <TextModeContext.Provider value={{
      isChatRunning,
      isPaused,
      startChat,
      stopChat,
      pauseChat,
      resumeChat,
      error,
      sendText,
      status,
      connectionState,
      streamingText
    }}>
      {children}
    </TextModeContext.Provider>
  );
}; 