import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHyphaStore } from '../../store/hyphaStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useThebe } from './ThebeProvider';
import { useVoiceMode, VoiceModeProvider } from './VoiceModeProvider';

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
        content: `# Welcome to the BioImage Analysis Demo

Let me show you some examples of what you can do with the code execution feature for bioimage analysis.

## Basic Examples

Here's a simple calculation that might be useful for pixel measurements:
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
        content: `And here's how to work with pixel intensity values in a region of interest:`
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
        content: `## Image Visualization

You can create beautiful plots to visualize image data with matplotlib:`
      },
      {
        type: 'code_execution',
        content: `import matplotlib.pyplot as plt
import numpy as np

# Create sine wave (similar to intensity profile)
x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.plot(x, y, 'b-', label='Intensity Profile 1')

# Add cosine wave (second intensity profile)
y2 = np.cos(x)
plt.plot(x, y2, 'r--', label='Intensity Profile 2')

plt.title('Intensity Profiles Comparison')
plt.xlabel('Distance (pixels)')
plt.ylabel('Intensity')
plt.grid(True)
plt.legend()
plt.show()`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `Or use plotly for interactive visualization of cell measurements:`
      },
      {
        type: 'code_execution',
        content: `import plotly.express as px
import numpy as np
import pandas as pd

# Create sample data (simulating cell measurements)
np.random.seed(42)
data = {
    'cell_type': ['Type A']*100 + ['Type B']*100,
    'fluorescence_intensity': np.concatenate([
        np.random.normal(0, 1, 100),
        np.random.normal(2, 1.5, 100)
    ])
}
df = pd.DataFrame(data)

# Create interactive histogram
fig = px.histogram(df, x='fluorescence_intensity', color='cell_type', 
                  marginal='box', 
                  title='Fluorescence Intensity Distribution by Cell Type')
fig.show()`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `## Working with Bioimage Data

Here's how to analyze experimental results with pandas:`
      },
      {
        type: 'code_execution',
        content: `import pandas as pd
# Create a sample dataset of cell measurements
data = {
    'cell_id': ['Cell_1', 'Cell_2', 'Cell_3', 'Cell_4', 'Cell_5'],
    'area_μm2': [125, 130, 135, 128, 122],
    'treatment': ['Control', 'Treatment A', 'Control', 'Treatment B', 'Treatment A'],
    'intensity': [95, 80, 85, 92, 88]
}
df = pd.DataFrame(data)

# Basic statistics
print("Dataset Overview:")
print(df)
print("\\nSummary Statistics:")
print(df.describe())

# Group analysis
print("\\nAverage intensity by area group:")
df['area_group'] = pd.cut(df['area_μm2'], bins=[120, 125, 130, 135])
print(df.groupby('area_group')['intensity'].mean())`,
        attrs: {
          language: 'python'
        }
      },
      {
        type: 'markdown',
        content: `## Interactive Widgets

You can create interactive widgets to explore your bioimage data:`
      },
      {
        type: 'code_execution',
        content: `from IPython.display import HTML

html_content = """
<div style="padding: 20px; background: #f0f0f0; border-radius: 8px;">
    <h2 style="color: #2c5282;">BioImage Analysis Dashboard</h2>
    <p style="color: #4a5568;">This is a custom interactive widget for exploring cell data!</p>
    <button onclick="alert('Cell data loaded successfully!')" 
            style="background: #4299e1; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">
        Load Sample Data
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

Each code block is independent and can be executed separately. Try modifying the code to experiment with different bioimage analysis techniques or create your own examples!`
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
  const { executeCode, executeCodeWithDOMOutput, isReady: isThebeReady } = useThebe();
  const { 
    isRecording, 
    isPaused,
    startRealTimeChat, 
    stopRealTimeChat,
    pauseRealTimeChat,
    resumeRealTimeChat,
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
  const [hasIncomingVoice, setHasIncomingVoice] = useState(false);

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

  // Add effect to show ripple when receiving voice message
  useEffect(() => {
    if (status?.includes('Audio response')) {
      setHasIncomingVoice(true);
      // Clear the effect after animation completes
      const timer = setTimeout(() => setHasIncomingVoice(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Register tools when Thebe becomes ready
  useEffect(() => {
    if (isThebeReady && schemaAgents) {
      // Create a callback for code execution
      const runCode = async (code: string) => {
        let outputs: OutputItem[] = [];
        let shortOutput = '';
        
        updateLastAssistantMessage(code, 'running', []);
        
        // Create a hidden div to hold the output that will be processed via DOM
        const outputElement = document.createElement('div');
    

        try {
          // Execute with DOM output to properly render scripts and widgets
          await executeCodeWithDOMOutput(code, outputElement, {
            onOutput: (out: { type: string; content: string; short_content?: string; attrs?: any }) => {
              shortOutput += out.short_content + '\n';
              updateLastAssistantMessage(code, 'running', outputs);
            },
            onStatus: (status: string) => {
              console.log('DOM execution status:', status);
              // When DOM execution completes, directly use the outputElement
              if (status === 'Completed' && outputElement.innerHTML) {
                // Add a custom output item for the DOM content
                const htmlOutputItem = {
                  type: 'html',
                  content: outputElement.innerHTML,
                  attrs: {
                    isRenderedDOM: true,
                    domElement: outputElement // Pass the actual DOM element
                  }
                };
                
                outputs.push(htmlOutputItem);
                
                // Update message with the DOM element
                updateLastAssistantMessage(code, 'success', outputs);
                
                // Don't remove the element since we're using it directly
                outputElement.style.display = ''; // Make it visible
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
        description: `Execute Python code with persistent kernel state and rich output display.
Features:
- Persistent variables and imports between runs
- Rich output: text, plots, HTML/JS widgets
- Pre-installed: numpy, scipy, pandas, matplotlib, plotly

Usage:
1. Basic code: print(), display()
2. Package install: await micropip.install(['pkg'])
3. Plots: plt.plot(); plt.show() or fig.show()

Note: Output is visible in UI. First comment used as block title.`,
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
          
          try {
            const { outputs, shortOutput } = await runCode(args.code);
            
            // Make sure DOM outputs are properly included in the message
            const hasDOMOutput = outputs.some(out => 
              out.type === 'html' && out.attrs?.isRenderedDOM
            );
            
            // Log outputs for debugging
            console.log('Code execution complete with outputs:', 
              outputs.map(o => ({ type: o.type, hasAttrs: !!o.attrs }))
            );
            
            if (hasDOMOutput) {
              console.log('DOM output is included in the results');
            }
            
            // Return the short output for the LLM
            return shortOutput;
          } catch (error) {
            console.error('Error in runCodeTool:', error);
            return `Error executing code: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      };

      registerTools([runCodeTool]);
    }
  }, [isThebeReady, schemaAgents, executeCode, registerTools, updateLastAssistantMessage]);

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

  // Add ripple animations to the existing styles
  const styles = `
    @keyframes ripple {
      0% {
        transform: scale(1);
        opacity: 0.25;
      }
      100% {
        transform: scale(2);
        opacity: 0;
      }
    }
    
    .animate-ripple-1 {
      animation: ripple 2s linear infinite;
    }
    
    .animate-ripple-2 {
      animation: ripple 2s linear infinite;
      animation-delay: 0.3s;
    }
    
    .animate-ripple-3 {
      animation: ripple 2s linear infinite;
      animation-delay: 0.6s;
    }
  `;

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

    const isDisabled = !schemaAgents || isTyping;
    const [isConnecting, setIsConnecting] = useState(false);

    const handleStartRealTimeChat = async () => {
      setIsConnecting(true);
      try {
        await startRealTimeChat({
          onItemCreated: handleItemCreated,
          instructions: composeInstructions(),
          voice: agentConfig.voice || "sage",
          temperature: agentConfig.temperature || (agentConfig.model?.includes("gpt-4") ? 0.7 : 0.8),
          max_output_tokens: agentConfig.max_output_tokens || 1024
        });
      } catch (error) {
        console.error('Failed to start recording:', error);
      } finally {
        setIsConnecting(false);
      }
    };

    const handleStopRealTimeChat = async () => {
      try {
        await stopRealTimeChat();
      } finally {
        setIsConnecting(false);
      }
    };

    const handlePauseResume = async () => {
      if (isPaused) {
        await resumeRealTimeChat();
      } else {
        await pauseRealTimeChat();
      }
    };

    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={isRecording ? handlePauseResume : handleStartRealTimeChat}
            disabled={isDisabled}
            className={`p-3 rounded-full transition-all duration-300 relative group ${
              isDisabled
                ? 'bg-gray-300 cursor-not-allowed scale-100'
                : isRecording 
                  ? isPaused
                    ? 'bg-yellow-500 hover:bg-yellow-600'
                    : 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-blue-500 hover:bg-blue-600'
            } transform hover:shadow-lg hover:scale-105`}
            title={
              !schemaAgents 
                ? "Waiting for AI service..."
                : isRecording 
                  ? isPaused
                    ? "Resume Recording"
                    : "Pause Recording" 
                  : "Start Recording"
            }
          >
            {isConnecting ? (
              // Spinner
              <div className="animate-spin">
                <svg className="w-8 h-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : isRecording ? (
              isPaused ? (
                // Play/Resume button with animation
                <svg 
                  className={`w-8 h-8 ${isDisabled ? 'text-gray-400' : 'text-white'} transform transition-transform duration-200 hover:scale-110`}
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z"/>
                </svg>
              ) : (
                // Pause button with animation
                <svg 
                  className={`w-8 h-8 ${isDisabled ? 'text-gray-400' : 'text-white'} transform transition-transform duration-200 hover:scale-110`}
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              )
            ) : (
              // Microphone button with wave animation
              <div className="relative">
                <svg 
                  className={`w-8 h-8 ${isDisabled ? 'text-gray-400' : 'text-white'} transform transition-transform duration-200`}
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                {isRecording && !isPaused && (
                  <div className="absolute -inset-2 rounded-full border-4 border-red-300 opacity-75 animate-ping"></div>
                )}
              </div>
            )}

            {/* Small stop button in corner - only show on hover */}
            {isRecording && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleStopRealTimeChat();
                }}
                className="absolute -top-1 -right-1 p-1 rounded-full bg-gray-600 hover:bg-gray-700 transition-all duration-300 transform hover:scale-110 shadow-lg z-10 opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Stop Recording"
              >
                <svg 
                  className="w-4 h-4 text-white"
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </div>
            )}

            {/* Ripple effect for incoming voice */}
            {hasIncomingVoice && (
              <>
                <div className="absolute inset-0 rounded-full animate-ripple-1 bg-blue-400 opacity-25"></div>
                <div className="absolute inset-0 rounded-full animate-ripple-2 bg-blue-400 opacity-25"></div>
                <div className="absolute inset-0 rounded-full animate-ripple-3 bg-blue-400 opacity-25"></div>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <VoiceModeProvider>
      <style>{styles}</style>
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-2">
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
            {/* Status and Error Display - Moved to top */}
            <div className="mb-2 text-xs text-center space-y-1">
              {voiceError && (
                <p className="text-red-500">
                  {voiceError}
                </p>
              )}
              {(!schemaAgents || !isThebeReady) && (
                <p className="text-gray-500">
                  {!schemaAgents ? "Connecting to AI service..." : "Waiting for code execution service..."}
                </p>
              )}
              {status && (
                <p className="text-blue-500">
                  {status}
                </p>
              )}
            </div>
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
          </div>
        </div>
      </div>
    </VoiceModeProvider>
  );
};

export default Chat;