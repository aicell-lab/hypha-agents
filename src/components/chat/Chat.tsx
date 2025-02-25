import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHyphaStore } from '../../store/hyphaStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useThebe } from './ThebeProvider';
import { hyphaWebsocketClient } from 'hypha-rpc';
import { useVoiceMode, VoiceModeProvider } from './VoiceModeProvider';
import { CodeBlock } from './CodeBlock';

export interface OutputItem {
  type: string;
  content: string;
  attrs?: any;
}

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
  role: 'user' | 'assistant';
  content: ContentItem[];
}

interface ChatProps {
  agentConfig: {
    name: string;
    profile?: string;
    goal?: string;
    model?: string;
    stream?: boolean;
    instructions?: string;
    welcomeMessage?: string;
    voice?: string;
    temperature?: number;
    max_output_tokens?: number;
  };
  className?: string;
  showActions?: boolean;
  onPreviewChat?: () => void;
  onPublish?: () => void;
  artifactId?: string;
  initialMessages?: Message[];
  enableVoiceMode?: boolean;
}

const generateSessionId = () => {
  const timestamp = new Date().getTime();
  const random = Math.random();
  return `${timestamp}-${random}`;
};

const defaultInitialMessages: Message[] = [
  {
    role: 'assistant',
    content: [
      {
        type: 'markdown',
        content: `# Welcome to the Code Execution Demo

Let me show you some examples of what you can do with the code execution feature.

## Basic Examples

Here's a simple calculation:
`
      },
      {
        type: 'code_execution',
        content: `x = 10
y = 20
print(f"{x} + {y} = {x + y}")`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `And here's how to work with lists:`
      },
      {
        type: 'code_execution',
        content: `numbers = [1, 2, 3, 4, 5]
squared = [n**2 for n in numbers]
print("Original:", numbers)
print("Squared:", squared)`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `## Data Visualization

You can create beautiful plots with matplotlib:`
      },
      {
        type: 'code_execution',
        content: `import matplotlib.pyplot as plt
import numpy as np

# Create sine wave
x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.plot(x, y, 'b-', label='sin(x)')

# Add cosine wave
y2 = np.cos(x)
plt.plot(x, y2, 'r--', label='cos(x)')

plt.title('Trigonometric Functions')
plt.xlabel('x')
plt.ylabel('y')
plt.grid(True)
plt.legend()
plt.show()`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `Or use plotly for interactive charts:`
      },
      {
        type: 'code_execution',
        content: `import plotly.express as px
import numpy as np
import pandas as pd

# Create sample data
np.random.seed(42)
data = {
    'group': ['A']*100 + ['B']*100,
    'value': np.concatenate([
        np.random.normal(0, 1, 100),
        np.random.normal(2, 1.5, 100)
    ])
}
df = pd.DataFrame(data)

# Create interactive histogram
fig = px.histogram(df, x='value', color='group', 
                  marginal='box', 
                  title='Distribution by Group')
fig.show()`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `## Working with Data

Here's how to analyze data with pandas:`
      },
      {
        type: 'code_execution',
        content: `import pandas as pd
# Create a sample dataset
data = {
    'name': ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],
    'age': [25, 30, 35, 28, 22],
    'city': ['New York', 'London', 'Paris', 'Tokyo', 'Berlin'],
    'score': [95, 80, 85, 92, 88]
}
df = pd.DataFrame(data)

# Basic statistics
print("Dataset Overview:")
print(df)
print("\\nSummary Statistics:")
print(df.describe())

# Group analysis
print("\\nAverage score by age group:")
df['age_group'] = pd.cut(df['age'], bins=[20, 25, 30, 35])
print(df.groupby('age_group')['score'].mean())`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `## Interactive Widgets

You can even create interactive HTML content:`
      },
      {
        type: 'code_execution',
        content: `from IPython.display import HTML

html_content = """
<div style="padding: 20px; background: #f0f0f0; border-radius: 8px;">
    <h2 style="color: #2c5282;">Interactive Demo</h2>
    <p style="color: #4a5568;">This is a custom HTML widget!</p>
    <button onclick="alert('Hello from JavaScript!')" 
            style="background: #4299e1; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">
        Click me!
    </button>
</div>
"""

HTML(html_content)`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `Feel free to try these examples by clicking the "Run" button on any code block. You can also collapse/expand the code blocks using the arrow icon.

Each code block is independent and can be executed separately. Try modifying the code to experiment with different values or create your own examples!`
      }
    ]
  }
];

const Chat: React.FC<ChatProps> = ({ 
  agentConfig, 
  className,
  showActions,
  onPreviewChat,
  onPublish,
  artifactId,
  initialMessages = defaultInitialMessages,
  enableVoiceMode = true
}) => {
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { server } = useHyphaStore();
  const { executeCode, isReady: isThebeReady } = useThebe();
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    error: voiceError, 
    registerTools, 
    status,
    sendTextMessage 
  } = useVoiceMode();
  
  // Use useMemo to create initial messages
  const initialMessagesList = React.useMemo(() => {
    const initMessages: Message[] = [];
    if (agentConfig.welcomeMessage) {
      initMessages.push({ 
        role: 'assistant', 
        content: [{ type: 'markdown', content: agentConfig.welcomeMessage }] 
      });
    }
    if (initialMessages.length > 0) {
      initMessages.push(...initialMessages);
    }
    return initMessages;
  }, [agentConfig.welcomeMessage, initialMessages]);

  const [messages, setMessages] = useState<Message[]>(initialMessagesList);
  const [isTyping, setIsTyping] = useState(false);
  const [schemaAgents, setSchemaAgents] = useState<any>(null);

  // Update messages when initialMessagesList changes
  useEffect(() => {
    setMessages(initialMessagesList);
  }, [initialMessagesList]);

  // Add code execution block to last assistant message
  const updateLastAssistantMessage = useCallback((code: string, status: string = 'running', outputs: OutputItem[]) => {
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === 'assistant') {
        const lastIndex = lastMessage.content.length - 1;
        const isExistingCodeBlock = lastMessage.content[lastIndex]?.type === 'code_execution';
        
        if (isExistingCodeBlock) {
          // Update existing code block
          const updatedContent = [...lastMessage.content];
          updatedContent[lastIndex] = {
            ...updatedContent[lastIndex],
            attrs: {
              ...updatedContent[lastIndex].attrs,
              status,
              output: outputs
            }
          };
          return [...prev.slice(0, -1), {
            ...lastMessage,
            content: updatedContent
          }];
        } else {
          // Add new code block
          return [...prev.slice(0, -1), {
            ...lastMessage,
            content: [...lastMessage.content, {
              type: 'code_execution',
              content: code,
              attrs: {
                language: 'python',
                status,
                output: outputs
              }
            }]
          }];
        }
      }
      return prev;
    });
  }, []);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (schemaAgents && isThebeReady) {
      // Create a callback for code execution
      const runCode = async (code: string) => {
        let outputs: OutputItem[] = [];
        let shortOutput = '';
        
        updateLastAssistantMessage(code, 'running', []);
        
        try {
          await executeCode(code, {
            onOutput: (out: { type: string; content: string; short_content?: string; attrs?: any }) => {
              outputs.push(out);
              // For images, create a div tag with data attributes
              if (out.type === 'img') {
                shortOutput += `<div data-type="image" data-id="${out.attrs?.id || ''}" data-alt="Output Image"></div>\n`;
              }
              // For HTML/SVG content
              else if (out.type === 'html' || out.type === 'svg') {
                shortOutput += `<div data-type="${out.type}" data-id="${out.attrs?.id || ''}"></div>\n`;
              }
              // For text content
              else {
                shortOutput += (out.short_content || out.content) + '\n';
              }
              updateLastAssistantMessage(code, 'running', outputs);
            },
            onStatus: (status: string) => {
              console.log('Execution status:', status);
              if (status === 'Completed') {
                updateLastAssistantMessage(code, 'success', outputs);
              } else if (status === 'Error') {
                updateLastAssistantMessage(code, 'error', outputs);
              }
            }
          });
          return { outputs, shortOutput };
        } catch (error) {
          console.error('Error executing code:', error);
          const errorOutput: OutputItem = {
            type: 'error',
            content: error instanceof Error ? error.message : 'Error executing code'
          };
          updateLastAssistantMessage(code, 'error', [errorOutput]);
          throw error;
        }
      };

      // Register the runCode tool
      const runCodeTool = {
        type: 'function' as const,
        name: 'runCode',
        description: `Python code execution environment with persistent kernel state and rich output display.

Key Features:
- Shared kernel: Variables and imports persist between executions
- Top-level await support
- Inline output display (text, plots, HTML)
- Pre-installed: numpy, scipy, pandas, matplotlib, plotly

Examples:
1. Define & reuse variables:
   x = 42
   data = pd.DataFrame(...)
   # Later blocks can use 'x' and 'data'

2. Install packages:
   import micropip
   await micropip.install(['package'])

3. Visualization:
   plt.plot(...); plt.show()  # Static plots
   fig.show()  # Interactive plotly

4. Rich output:
   - Text/print output
   - Interactive plots
   - HTML widgets
   - DataFrames
   
Note: All code runs in the same kernel, sharing state and variables.`,
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        },
        fn: async (args: { code: string }) => {
          // Ensure there's an assistant message before running code
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (!lastMessage || lastMessage.role !== 'assistant') {
              return [...prev, {
                role: 'assistant',
                content: []
              }];
            }
            return prev;
          });
          
          const { outputs, shortOutput } = await runCode(args.code);
          // Return the short output for the LLM
          return shortOutput;
        }
      };

      registerTools([runCodeTool]);
    }
  }, [schemaAgents, isThebeReady, executeCode, registerTools, updateLastAssistantMessage]);

  // Handle conversation items
  const handleItemCreated = useCallback((item: any) => {
    console.log('Handling created item:', item);
    
    if (item.type === 'message') {
      if(!item.content || item.content.length <= 0) {
        console.log('Empty content, skipping');
        return;
      }

      // Convert the content items
      const convertedContent = item.content.map((c: any) => {
        console.log('Converting content item:', c);
        
        if (c.type === 'text') {
          return {
            type: 'markdown',
            content: c.text,
            attrs: {
              ...c.attrs,
              transcript: c.transcript
            }
          };
        }
        else if(c.type === 'input_text') {
          return {
            type: 'markdown',
            content: c.text,
            attrs: {
              ...c.attrs,
              transcript: c.transcript,
              status: c.status
            }
          };
        }
        else if(c.type === 'tool_call') {
          const code = typeof c.content === 'string' ? 
            c.content : 
            c.content?.code || c.content;
            
          return {
            type: 'code_execution',
            content: code,
            attrs: {
              ...c.attrs,
              language: 'python',
              status: 'running',
              call_id: c.attrs.call_id
                }
              };
            }
        else if(c.type === 'tool_call_output') {
          // Use short_content if available
          const content = c.content?.short_content || c.content;
          return {
            type: 'code_execution',
            content: '',
            attrs: {
              ...c.attrs,
              output: content,
              status: c.attrs.success ? 'success' : 'error'
            }
          };
        }
        return {
          type: c.type,
          content: c.content?.short_content || c.content,
          attrs: {
            ...c.attrs,
            transcript: c.transcript
          }
        };
      });

      console.log('Converted content:', convertedContent);

      setMessages(prev => {
        // Get the last message
        const lastMessage = prev[prev.length - 1];
        
        // For assistant messages, check if we should append or create new
        if (item.role === 'assistant') {
          // If the last message is from assistant and was created recently (within 2 seconds)
          // append to it instead of creating a new message
          if (lastMessage?.role === 'assistant') {
            // Check if the content is not already included (deduplication)
            const newContentTexts = convertedContent.map((c: ContentItem) => c.content);
            const existingContentTexts = lastMessage.content.map((c: ContentItem) => c.content);
            
            const hasNewContent = newContentTexts.some((text: string) => 
              !existingContentTexts.includes(text)
            );

            if (hasNewContent) {
              console.log('Appending new content to last assistant message');
              const updatedMessage = {
                ...lastMessage,
                content: [...lastMessage.content, ...convertedContent]
              };
              return [...prev.slice(0, -1), updatedMessage];
            }
            
            // If content already exists, return previous state unchanged
            console.log('Content already exists, skipping update');
            return prev;
          }
        }
        
        // For user messages or new assistant messages, always create new
        console.log('Creating new message:', { role: item.role, content: convertedContent });
        return [...prev, { role: item.role, content: convertedContent }];
      });
    }
  }, []);

  const handleSendMessage = async (message: string) => {
    if (!agentConfig || !schemaAgents || !isThebeReady) return;

    setIsTyping(true);

    try {
      // Send message using VoiceModeProvider's sendTextMessage
      sendTextMessage(message);
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: [{ 
          type: 'markdown', 
          content: 'Sorry, I encountered an error processing your message.' 
        }] 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Add voice button component
  const VoiceButton = () => {
    // Compose instructions from agent config
    const composeInstructions = () => {
      const parts = [
        `You are ${agentConfig.name}, ${agentConfig.profile}.`,
        `Your goal is: ${agentConfig.goal}`,
        `Note: Some outputs may be stored in a key-value store for efficiency. When you see a message like "[Content stored with key: type_timestamp_random]", you can access the full content by using the key in a div tag like this: <div id="type_timestamp_random"></div>. This will be replaced with the full content when rendered.`,
        agentConfig.instructions
      ];
      return parts.filter(Boolean).join('\n\n');
    };

    const isDisabled = !schemaAgents || isTyping || !isThebeReady;
    const [isConnecting, setIsConnecting] = useState(false);

    const handleStartRecording = async () => {
      setIsConnecting(true);
      try {
        await startRecording({
          onItemCreated: handleItemCreated,
          instructions: composeInstructions(),
          voice: agentConfig.voice || "sage",
          temperature: agentConfig.temperature || (agentConfig.model?.includes("gpt-4") ? 0.7 : 0.8),
          max_output_tokens: agentConfig.max_output_tokens || 1024
        });
      } catch (error) {
        console.error('Failed to start recording:', error);
        setIsConnecting(false);
      }
    };

    const handleStopRecording = async () => {
      try {
        await stopRecording();
      } finally {
        setIsConnecting(false);
      }
    };

    return (
      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={isDisabled}
        className={`p-2 rounded-full transition-colors relative ${
          isDisabled
            ? 'bg-gray-300 cursor-not-allowed'
            : isRecording 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
        }`}
        title={
          !schemaAgents 
            ? "Waiting for AI service..."
            : !isThebeReady
              ? "Waiting for code execution service..."
              : isRecording 
                ? "Stop Recording" 
                : "Start Recording"
        }
      >
        {isConnecting ? (
          // Spinner
          <div className="animate-spin">
            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : isRecording ? (
          // Stop/Close button
          <svg 
            className={`w-6 h-6 ${isDisabled ? 'text-gray-400' : 'text-white'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          // Microphone button
          <svg 
            className={`w-6 h-6 ${isDisabled ? 'text-gray-400' : 'text-white'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </button>
    );
  };

  return (
    <VoiceModeProvider>
      <div className={`flex flex-col h-full ${className}`}>
        {/* Actions Bar - Only show if showActions is true */}
        {showActions && (
          <div className="flex-shrink-0 border-b border-gray-200 bg-white">
            <div className="p-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Preview</h3>
                <div className="flex items-center gap-4">
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
          </div>
        )}

        {/* Chat Messages - Scrollable area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-4xl mx-auto w-full">
            {/* Chat Messages */}
            {messages.map((message, index) => (
              <ChatMessage 
                key={index} 
                message={message} 
                isLoading={isTyping && index === messages.length - 1}
              />
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <ChatMessage 
                message={{ 
                  role: 'assistant', 
                  content: [{ type: 'markdown', content: 'Assistant is thinking...' }] 
                }} 
                isLoading={true}
              />
            )}
            
            <div ref={messageEndRef} />
          </div>
        </div>

        {/* Chat Input - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              {enableVoiceMode && (
                <div className="flex-shrink-0 flex items-center">
                  <VoiceButton />
                </div>
              )}
              <div className="flex-1">
                <ChatInput 
                  onSend={handleSendMessage} 
                  disabled={isTyping || !schemaAgents || !isThebeReady} 
                  isTyping={isTyping}
                  isThebeReady={isThebeReady}
                  placeholder={
                    !schemaAgents 
                      ? "Initializing AI service..." 
                      : !isThebeReady
                        ? "Waiting for code execution service..."
                        : isTyping 
                          ? "Please wait..."
                          : "Type your message..."
                  }
                />
              </div>
            </div>
            {voiceError && (
              <p className="text-xs text-red-500 mt-2">
                {voiceError}
              </p>
            )}
            {(!schemaAgents || !isThebeReady) && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                {!schemaAgents ? "Connecting to AI service..." : "Waiting for code execution service..."}
              </p>
            )}
            {status && (
              <p className="text-xs text-blue-500 mt-2 text-center">
                {status}
              </p>
            )}
          </div>
        </div>
      </div>
    </VoiceModeProvider>
  );
};

export default Chat;