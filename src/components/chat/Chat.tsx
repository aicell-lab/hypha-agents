import React, { useState, useRef, useEffect } from 'react';
import { useHyphaStore } from '../../store/hyphaStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useThebe } from './ThebeProvider';
import { hyphaWebsocketClient } from 'hypha-rpc';

interface OutputType {
  type: string;
  content: string;
  attrs?: any;
}

interface ContentItem {
  type: 'markdown' | 'code_execution' | 'tool_call' | 'image' | 'html';
  content: string;
  attrs?: {
    language?: string;
    output?: string;
    [key: string]: any;
  };
}

interface Message {
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
  };
  welcomeMessage?: string;
  className?: string;
  showActions?: boolean;
  onPreviewChat?: () => void;
  onPublish?: () => void;
  artifactId?: string;
  initialMessages?: Message[];
}

const generateSessionId = () => {
  const timestamp = new Date().getTime();
  const random = Math.random();
  return `${timestamp}-${random}`;
};

const initialMessages: Message[] = [
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
print("\nSummary Statistics:")
print(df.describe())

# Group analysis
print("\nAverage score by age group:")
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
  welcomeMessage, 
  className,
  showActions,
  onPreviewChat,
  onPublish,
  artifactId,
  initialMessages = []
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { server } = useHyphaStore();
  const [schemaAgents, setSchemaAgents] = useState<any>(null);
  const { executeCode, isReady: isThebeReady } = useThebe();

  // Initialize messages with welcome message and initial messages
  useEffect(() => {
    const initMessages: Message[] = [];
    if (welcomeMessage) {
      initMessages.push({ role: 'assistant', content: [{ type: 'markdown', content: welcomeMessage }] });
    }
    if (initialMessages.length > 0) {
      initMessages.push(...initialMessages);
    }
    if (initMessages.length > 0) {
      setMessages(initMessages);
    }
  }, [welcomeMessage, initialMessages]);

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

  // Handle code execution output
  const handleOutput = (output: OutputType) => {
    // Handle the output
    console.log('Received output:', output);
    return output;
  };

  // Handle execution status
  const handleStatus = (status: string) => {
    console.log('Execution status:', status);
    return status;
  };

  const handleSendMessage = async (message: string) => {
    if (!agentConfig || !schemaAgents || !isThebeReady) return;

    // Add user message
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: [{ type: 'markdown', content: message }] 
    }]);
    setIsTyping(true);

    const currentMessageIndex = messages.length;
    let currentContent: ContentItem[] = [];

    try {
      // Create a callback for code execution
      const runCode = async (code: string) => {
        // Add the code execution to the current message
        const executionIndex = currentContent.length;
        const codeExecution: ContentItem = {
          type: 'code_execution',
          content: code,
          attrs: {
            language: 'python',
            output: 'Executing...'
          }
        };

        // Clear any previous HTML outputs that might be related to this code execution
        currentContent = currentContent.filter((item, idx) => 
          idx < executionIndex || 
          (item.type !== 'html' && !item.content.includes('plotly-graph-div'))
        );
        
        currentContent.push(codeExecution);
        
        // Update the message with current content
        const updateMessage = () => {
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[currentMessageIndex]) {
              newMessages[currentMessageIndex] = {
                role: 'assistant',
                content: [...currentContent]
              };
            }
            return newMessages;
          });
        };
        updateMessage();

        // Execute the code using the Thebe kernel with real-time output handling
        await executeCode(code, {
          onOutput: (output: OutputType) => {
            // Handle plotly output specially
            if (output.type === 'html' && output.content.includes('plotly-graph-div')) {
              // Add plotly script if not already added
              if (!currentContent.some(item => 
                item.type === 'html' && 
                item.content.includes('cdn.plot.ly/plotly')
              )) {
                currentContent.push({
                  type: 'html',
                  content: `<div id="plotly-output" style="min-height: 400px;">
                    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
                  </div>`
                });
              }
              // Add the plotly output
              currentContent.push({
                type: 'html',
                content: output.content
              });
            } else {
              // Update the current execution's output in real-time
              currentContent[executionIndex].attrs!.output = 
                (currentContent[executionIndex].attrs!.output === 'Executing...' ? '' : currentContent[executionIndex].attrs!.output) + 
                output.content;
            }
            updateMessage();
          },
          onStatus: (status: string) => {
            console.log('Execution status:', status);
          }
        });

        // Get the final output
        return currentContent[executionIndex].attrs!.output;
      };

      const runCodeTool = hyphaWebsocketClient.schemaFunction(runCode, {
        name: 'runCode',
        description: 'Run the code in the code execution block',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        }
      });

      // Create a streaming callback
      const streamingCallback = async (event: any) => {
        // Add or update markdown content
        if (event.content) {
          currentContent.push({
            type: 'markdown',
            content: event.content
          });
        }

        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[currentMessageIndex]) {
            newMessages[currentMessageIndex] = {
              role: 'assistant',
              content: [...currentContent]
            };
          } else {
            newMessages.push({
              role: 'assistant',
              content: [...currentContent]
            });
          }
          return newMessages;
        });
      };

      // Call the agent with both callbacks
      const response = await schemaAgents.acall(message, {
        agent_config: agentConfig,
        tools: [runCodeTool],
        streaming_callback: streamingCallback,
        _rkwargs: true
      });

      // Ensure the final message is set
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[currentMessageIndex]) {
          newMessages[currentMessageIndex] = {
            role: 'assistant',
            content: [...currentContent]
          };
        } else {
          newMessages.push({
            role: 'assistant',
            content: [...currentContent]
          });
        }
        return newMessages;
      });
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

  return (
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
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
          {(!schemaAgents || !isThebeReady) && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              {!schemaAgents ? "Connecting to AI service..." : "Waiting for code execution service..."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;