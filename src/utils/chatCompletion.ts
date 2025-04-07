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
}

export interface AgentSettings {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  instructions: string;
}
const RESPONSE_INSTRUCTIONS = `
You must respond with a valid Python script that ALWAYS starts with a thoughts comment:

#Thoughts: Brief thoughts in max 5 words

Then either:
1. Python code to execute, or
2. Just a final response comment

Example responses:

When user asks "Plot a sine wave":
#Thoughts: import numpy plot sine wave\n\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 2*np.pi, 100)\ny = np.sin(x)\n\nplt.plot(x, y)\nplt.title('Sine Wave')\nplt.xlabel('x')\nplt.ylabel('sin(x)')\nplt.grid(True)\nplt.show()"

After seeing the plot:
#Thoughts: plot complete, give feedback\n#FinalResponse: I've created a basic sine wave plot. The graph shows one complete cycle of the sine function from 0 to 2π. The wave oscillates between -1 and 1 on the y-axis. Would you like to modify any aspects of the plot?"


INTERACTION GUIDELINES:

1. SCRIPT FORMAT
   - ALWAYS start with #Thoughts: comment (max 5 words)
   - For actions: Include executable Python code
   - For final responses: Use #FinalResponse: comment
   - Keep code clean and well-documented
   - Include necessary imports
   - Use clear variable names

2. WORKFLOW
   - Need information? → Write code to gather it
   - Have all info? → Use #FinalResponse:
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
  const match = script.match(/#FinalResponse:\s*(.*)/);
  return match ? match[1].trim() : null;
}

// Helper function to extract thoughts from script
function extractThoughts(script: string): string | null {
  const match = script.match(/#Thoughts:\s*(.*)/);
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
      const stream = await openai.chat.completions.create({
        model,
        messages: fullMessages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature,
        stream: true,
      });

      // Process the stream and accumulate JSON
      for await (const chunk of stream) {
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

        yield {
          type: 'function_call',
          name: 'runCode',
          arguments: {
            code: accumulatedResponse,
          },
          call_id: toolCallId
        };

        // Add the tool call to messages
        messages.push({
          role: 'assistant',
          content: `To help me complete your request, please execute the following code:\n\`\`\`\n${accumulatedResponse}\n\`\`\``
        });

        // Execute the tool call
        const result = await onToolCall(
          completionId,
          {
            name: 'runCode',
            arguments: {
              code: accumulatedResponse,
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
          content: `I have executed the code. Here are the outputs:\n\`\`\`\n${result}\n\`\`\`\nNow continue with the next step.`
        });

        // Check if we've hit the loop limit
        if (loopCount >= maxSteps) {
          console.warn(`Chat completion reached maximum loop limit of ${maxSteps}`);
          if(onMessage){
            onMessage(completionId, `\n\nNote: Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. Please try breaking your request into smaller steps.`);
          }
          yield {
            type: 'text',
            content: `\n\nNote: Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. Please try breaking your request into smaller steps.`
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

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export async function* chatCompletion({
  messages,
  systemPrompt,
  model = 'qwen2.5-coder:7b',
  temperature = 0.7,
  onToolCall,
  onMessage,
  onStreaming,
  maxSteps = 10, // Default to 10 loops
  baseURL = 'http://localhost:11434/v1/',
  apiKey = 'ollama',
}: ChatCompletionOptions): AsyncGenerator<{
  type: 'text' | 'function_call' | 'function_call_output' | 'new_completion';
  content?: string;
  name?: string;
  arguments?: any;
  call_id?: string;
  completion_id?: string;
}, void, unknown> {
  try {
    // Get OpenAI API key from schema-agents service
    // const schemaAgents = await server.getService("schema-agents");
    // const session = await schemaAgents?.get_openai_token();
    // const API_KEY = session.client_secret.value;

    // Initialize OpenAI client with provided settings
    const openai = new OpenAI({
    //   apiKey: API_KEY,
        baseURL,
        apiKey,
      dangerouslyAllowBrowser: true
    });

    // Track all pending tool calls and their promises
    const pendingToolCalls: {
      toolCall: any;
      promise: Promise<string>;
    }[] = [];

    let loopCount = 0;

    while (loopCount < maxSteps) {
      loopCount++;
      // Prepare messages array with system prompt if provided
      const fullMessages = systemPrompt 
        ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
        : messages;
      const completionId = generateId();

      // Create streaming completion
      const stream = await openai.chat.completions.create({
        model,
        messages: fullMessages as OpenAI.Chat.ChatCompletionMessageParam[],
        // tools: formattedTools,
        // tool_choice: 'auto',
        temperature,
        stream: true
      });

      // Process the stream
      let accumulatedResponse = '';
      let currentToolCall: any = null;
      let hasToolCalls = false;

      yield {
        type: 'new_completion',
        completion_id: completionId,
      };

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        
        // Handle tool calls
        if (choice?.delta?.tool_calls) {
          hasToolCalls = true;
          for (const toolCall of choice.delta.tool_calls) {
            if (!currentToolCall || toolCall.index !== currentToolCall.index) {
              // New tool call
              if (currentToolCall) {
                // Yield the completed previous tool call
                yield {
                  type: 'function_call',
                  name: currentToolCall.function.name,
                  arguments: JSON.parse(currentToolCall.function.arguments),
                  call_id: currentToolCall.id
                };

                if (onToolCall) {
                  // Start the tool call immediately and store its promise
                  const toolCallPromise = onToolCall(completionId, {
                    name: currentToolCall.function.name,
                    arguments: JSON.parse(currentToolCall.function.arguments),
                    call_id: currentToolCall.id
                  });

                  pendingToolCalls.push({
                    toolCall: currentToolCall,
                    promise: toolCallPromise
                  });
                }
              }

              currentToolCall = {
                index: toolCall.index,
                id: toolCall.id || '',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || ''
                }
              };
            } else {
              // Append to existing tool call
              if (toolCall.function?.name) {
                currentToolCall.function.name += toolCall.function.name;
              }
              if (toolCall.function?.arguments) {
                currentToolCall.function.arguments += toolCall.function.arguments;
              }
              if (toolCall.id) {
                currentToolCall.id = toolCall.id;
              }
            }
          }
        } 
        // Handle regular text content
        else if (choice?.delta?.content) {
          accumulatedResponse += choice.delta.content;
          if(onMessage){
            onMessage(completionId, choice.delta.content);
          }
          yield {
            type: 'text',
            content: accumulatedResponse
          };
        }
      }

      // Handle final tool call if exists
      if (currentToolCall && onToolCall) {
        yield {
          type: 'function_call',
          name: currentToolCall.function.name,
          arguments: JSON.parse(currentToolCall.function.arguments),
          call_id: currentToolCall.id
        };

        const toolCallPromise = onToolCall(completionId, {
          name: currentToolCall.function.name,
          arguments: JSON.parse(currentToolCall.function.arguments),
          call_id: currentToolCall.id
        });

        pendingToolCalls.push({
          toolCall: currentToolCall,
          promise: toolCallPromise
        });
      }

      // If there were tool calls, wait for all of them to complete
      if (hasToolCalls && pendingToolCalls.length > 0) {
        // Wait for all tool calls to complete and get results
        const results = await Promise.all(
          pendingToolCalls.map(({ toolCall, promise }) => promise.then(result => ({ result, toolCall })))
        );

        // Yield all function call outputs
        for (const { result, toolCall } of results) {
          yield {
            type: 'function_call_output',
            content: result,
            call_id: toolCall.id
          };
        }

        const toolCalls = results.map(({ result, toolCall }) => ({
          type: 'function',
          name: toolCall.function.name,
          function: toolCall.function,
          id: toolCall.id
        }));

        messages.push({
          tool_calls: toolCalls,
          role: "assistant",
        });

        // Add all tool responses to messages for context
        results.forEach(({ result, toolCall }) => {
           
          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id
          });
        });

        // Clear pending tool calls for next iteration
        pendingToolCalls.length = 0;

        // Check if we've hit the loop limit
        if (loopCount >= maxSteps) {
          console.warn(`Chat completion reached maximum loop limit of ${maxSteps}`);
          if(onMessage){
            onMessage(completionId, `\n\nNote: Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. Please try breaking your request into smaller steps.`);
          }
          yield {
            type: 'text',
            content: `\n\nNote: Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. Please try breaking your request into smaller steps.`
          };
          break;
        }
      } else {
        // No tool calls, we can break the loop
        break;
      }
    }
  } catch (err) {
    console.error('Error in chat completion:', err);
    throw err;
  }
} 