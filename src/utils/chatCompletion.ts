import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content?: string;
  tool_call_id?: string;
  tool_calls?: {
    type: string;
    name: string;
    function: any;
    id: string;
  }[];
}


function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  onToolCall?: (completionId: string, toolCall: any) => Promise<string>;
  onMessage?: (completionId: string, message: string) => void;
  onStreaming?: (completionId: string, message: string) => void;
  maxSteps?: number; // Maximum number of tool call steps before stopping
  baseURL?: string; // Base URL for the API
  apiKey?: string; // API key for authentication
  stream?: boolean;
}

export interface AgentSettings {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  instructions: string;
}
const RESPONSE_INSTRUCTIONS = `
You must respond with thoughts tag:
<thoughts>Brief thoughts in max 5 words</thoughts>

Then EITHER:
1. Python code to execute (wrapped in <python> tags), or
2. A final response (wrapped in <finalResponse> tags)

Example responses:

When executing code:
<thoughts>Plotting sine wave with numpy</thoughts>
<python>
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 2*np.pi, 100)
y = np.sin(x)

plt.plot(x, y)
plt.title('Sine Wave')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)
plt.show()
</python>

When providing a final response:
<thoughts>Explaining the sine plot</thoughts>
<finalResponse>
I've created a basic sine wave plot. The graph shows one complete cycle of the sine function from 0 to 2π. The wave oscillates between -1 and 1 on the y-axis. Would you like to modify any aspects of the plot?
</finalResponse>

INTERACTION GUIDELINES:

1. RESPONSE FORMAT
   - ALWAYS start with <thoughts> tag (max 5 words)
   - For actions: Use <python> tags with Python code
   - For final responses: Use <finalResponse> tags
   - Keep code clean and well-documented
   - Include necessary imports
   - Use clear variable names

2. WORKFLOW
   - Need information? → Write code to gather it
   - Have all info? → Use <finalResponse>
   - Complex tasks → Multiple code-response rounds
   - Always handle errors gracefully

3. BEST PRACTICES
   - Break complex tasks into steps
   - Verify assumptions with code
   - Test results before finalizing
   - Give clear error messages
   - Document complex operations
`;

// Update defaultAgentConfig to use the AgentSettings interface
export const DefaultAgentConfig: AgentSettings = {
    baseURL: 'http://localhost:11434/v1/',
    apiKey: 'ollama',
    model: 'qwen2.5-coder:7b',
    temperature: 0.7,
    instructions: `You are a code assistant specialized in generating Python code for notebooks.`
  };

// Helper function to extract final response from script
function extractFinalResponse(script: string): string | null {
  const match = script.match(/<finalResponse>([\s\S]*?)<\/finalResponse>/);
  return match ? match[1].trim() : null;
}

// Helper function to extract thoughts from script
function extractThoughts(script: string): string | null {
  const match = script.match(/<thoughts>([\s\S]*?)<\/thoughts>/);
  return match ? match[1].trim() : null;
}

// Helper function to extract script content
function extractScript(script: string): string | null {
  const match = script.match(/<python>([\s\S]*?)<\/python>/);
  return match ? match[1].trim() : null;
}

export async function* structuredChatCompletion({
  messages,
  systemPrompt,
  model = 'qwen2.5-coder:7b',
  temperature = 0.7,
  onToolCall,
  onMessage,
  onStreaming,
  maxSteps = 10,
  baseURL = 'http://localhost:11434/v1/',
  apiKey = 'ollama',
  stream = true,
}: ChatCompletionOptions): AsyncGenerator<{
  type: 'text' | 'function_call' | 'function_call_output' | 'new_completion';
  content?: string;
  name?: string;
  arguments?: any;
  call_id?: string;
  completion_id?: string;
}, void, unknown> {
  try {
    systemPrompt = (systemPrompt || '') + RESPONSE_INSTRUCTIONS;
    const openai = new OpenAI({
      baseURL,
      apiKey,
      dangerouslyAllowBrowser: true
    });

    let loopCount = 0;
    
    while (loopCount < maxSteps) {
      loopCount++;
      const fullMessages = systemPrompt 
        ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
        : messages;
      const completionId = generateId();
      console.log('DEBUG: new completion', completionId, 'fullMessages:', fullMessages);

      yield {
        type: 'new_completion',
        completion_id: completionId,
      };

      let accumulatedResponse = '';

      // Create standard completion stream
      const completionStream = await openai.chat.completions.create({
        model,
        messages: fullMessages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature,
        stream: stream,
      });

      // Process the stream and accumulate JSON
      for await (const chunk of completionStream) {
        const content = chunk.choices[0]?.delta?.content || '';
        accumulatedResponse += content;

        if(onStreaming){
          onStreaming(completionId, accumulatedResponse);
        }
        yield {
          type: 'text',
          content: accumulatedResponse
        };
      }

      // Parse and validate the accumulated JSON
      try {
       
        // Extract thoughts for logging
        const thoughts = extractThoughts(accumulatedResponse);
        if (thoughts) {
          console.log('Thoughts:', thoughts);
        }
        // Check if this is a final response
        const finalResponse = extractFinalResponse(accumulatedResponse);
        
        if (finalResponse) {
          if(onMessage){
              onMessage(completionId, finalResponse);
          }
          yield {
            type: 'text',
            content: finalResponse
          };
          break;
        }
        
        // Handle script execution
        if(!onToolCall){
          throw new Error('onToolCall is not defined');
        }
        const toolCallId = `tool_${Date.now()}`;

        // Extract script content if it exists
        const scriptContent = extractScript(accumulatedResponse);
        if (scriptContent) {
          yield {
            type: 'function_call',
            name: 'runCode',
            arguments: {
              code: scriptContent,
            },
            call_id: toolCallId
          };

          // Add the tool call to messages with XML format
          messages.push({
            role: 'assistant',
            content: `<thoughts>${extractThoughts(accumulatedResponse)}</thoughts>\n<python>${scriptContent}</python>`
          });

          // on Streaming about executing the code
          if(onStreaming){
            onStreaming(completionId, `Executing code...`);
          }

          // Execute the tool call
          const result = await onToolCall(
            completionId,
            {
              name: 'runCode',
              arguments: {
                code: scriptContent,
              },
              call_id: toolCallId
            }
          );

          // Yield the tool call output
          yield {
            type: 'function_call_output',
            content: result,
            call_id: toolCallId
          };

          // Add tool response to messages
          messages.push({
            role: 'user',
            content: `<observation>I have executed the code. Here are the outputs:\n\`\`\`\n${result}\n\`\`\`\nNow continue with the next step.</observation>`
          });
        }

        // Check if we've hit the loop limit
        if (loopCount >= maxSteps) {
          console.warn(`Chat completion reached maximum loop limit of ${maxSteps}`);
          if(onMessage){
            onMessage(completionId, `<thoughts>Maximum steps reached</thoughts>\n<finalResponse>Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. Please try breaking your request into smaller steps.</finalResponse>`);
          }
          yield {
            type: 'text',
            content: `<thoughts>Maximum steps reached</thoughts>\n<finalResponse>Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. Please try breaking your request into smaller steps.</finalResponse>`
          };
          break;
        }
      } catch (error: unknown) {
        console.error('Error parsing JSON response:', error);
        if (error instanceof Error) {
          throw new Error(`Failed to parse LLM response as valid JSON: ${error.message}`);
        }
        throw new Error('Failed to parse LLM response as valid JSON');
      }
    }
  } catch (err) {
    console.error('Error in structured chat completion:', err);
    throw err;
  }
}
