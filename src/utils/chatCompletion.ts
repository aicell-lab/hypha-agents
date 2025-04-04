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
  onToolCall?: (toolCall: any) => Promise<string>;
  onMessage?: (completionId: string, message: string) => void;
  maxSteps?: number; // Maximum number of tool call steps before stopping
  baseURL?: string; // Base URL for the API
  apiKey?: string; // API key for authentication
}

// Define the response schema for the code agent
// Note: it seems better to use nullable for optional fields https://github.com/Klimatbyran/garbo/issues/473
const CodeAgentResponse = z.object({
  // Chain of Drafts reasoning https://arxiv.org/abs/2502.18600
  thoughts: z.array(z.string()).nullable().describe('Brief reasoning for the current response or script, 5 words at most'),
  response: z.string().describe('Response to be displayed to the user'),
  script: z.string().nullable().describe('Optional: The python script to be executed to fulfill the request'),
//   cell_id: z.string().nullable().describe('Optional: used to update an existing cell for error recovery; if not provided, a new cell will be created'),
//   is_final: z.boolean().describe('Whether the response is final'),
});


export interface AgentSettings {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  instructions: string;
}

// Update defaultAgentConfig to use the AgentSettings interface
export const DefaultAgentConfig: AgentSettings = {
    baseURL: 'http://localhost:11434/v1/',
    apiKey: 'ollama',
    model: 'qwen2.5-coder:7b',
    temperature: 0.7,
    instructions: `You are a code assistant specialized in generating Python code for notebooks. Follow these guidelines:
  
  1. RESPONSE FORMAT
     You must respond in a structured format with the following fields:
     - thoughts (required): Your step by step reasoning and planning, but only keep a minimum draft for
each step, with 5 words at most!
     - response (required): Your main response to the user, explaining what you're doing or your findings
     - script (optional): Python code to execute to gather information or perform actions; Must be a valid multi-line python script
  
  2. INTERACTION FLOW
     - If you need information: Include a script to gather it, then wait for results
     - If you have all needed info: Provide final response without a script
     - You can have multiple script-response rounds to build up context
  
  3. CODE GENERATION
     - Write clean, well-documented Python code
     - Include necessary imports
     - Use clear variable names
     - Add comments for complex operations
  
  4. EXAMPLE RESPONSE FORMAT:
     When user asks "Plot a sine wave":
     {
        // 5 words at most"
       "thoughts": ["import", "data", "plot;show"],
       "response": "I'll help you create a plot of a sine wave using numpy and matplotlib.",
       "script": "import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 2*np.pi, 100)\ny = np.sin(x)\n\nplt.plot(x, y)\nplt.title('Sine Wave')\nplt.xlabel('x')\nplt.ylabel('sin(x)')\nplt.grid(True)\nplt.show()"
     }
  
     After seeing the plot:
     {
       "thoughts": ["plot", "modify", "xy-axis"],
       "response": "I've created a basic sine wave plot. The graph shows one complete cycle of the sine function from 0 to 2π. The wave oscillates between -1 and 1 on the y-axis. Would you like to modify any aspects of the plot?",
       "script": ""
     }
  
  5. BEST PRACTICES
     - Use scripts to verify assumptions or gather data
     - Provide clear explanations in the response field
     - Document your reasoning in the thoughts field
     - Break complex tasks into multiple steps
     - Handle errors gracefully with clear error messages
  
  6. WHEN USING SCRIPTS
     - For data exploration: Use scripts to inspect variables, check shapes, or verify assumptions
     - For visualization: Create plots to help understand the data
     - For verification: Test code or validate results
     - For complex operations: Break down into smaller, testable steps
  
  7. FINAL RESPONSES
     - Always end with a response-only output (no script) to summarize or conclude
     - Make sure the final response is clear and actionable
     - Include relevant observations from script outputs
     - Suggest next steps if appropriate`
  };

export async function* structuredChatCompletion({
  messages,
  systemPrompt,
  model = 'qwen2.5-coder:7b',
  temperature = 0.7,
  onToolCall,
  onMessage,
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
    // Initialize OpenAI client with provided settings
    const openai = new OpenAI({
      baseURL,
      apiKey,
      dangerouslyAllowBrowser: true
    });

    let loopCount = 0;

    while (loopCount < maxSteps) {
      loopCount++;
      // Prepare messages array with system prompt if provided
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
      let accumulatedJson = '';
      let isInJsonBlock = false;

      // Create standard completion stream
      const stream = await openai.chat.completions.create({
        model,
        messages: fullMessages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature,
        response_format: zodResponseFormat(CodeAgentResponse, "code_agent_response"),
        stream: true,
      });

      // Process the stream and accumulate JSON
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        accumulatedResponse += content;
        
        if (content.includes('{') && !isInJsonBlock) {
          isInJsonBlock = true;
        }
        
        if (isInJsonBlock) {
          accumulatedJson += content;
        }

        if(onMessage){
          onMessage(completionId, accumulatedResponse);
        }
        yield {
          type: 'text',
          content: accumulatedResponse
        };
      }

      // Parse and validate the accumulated JSON
      try {
        const jsonResponse = JSON.parse(accumulatedJson);
        const parsedResponse = CodeAgentResponse.parse(jsonResponse);

        // trim the script
        parsedResponse.script = (parsedResponse.script || '').trim();
        // sometimes the script is in markdown format, so we need to convert it to code
        // ``` or ```python quotes are not allowed in the script
        // use regex to strip the outter most quotes and the python prefix
        parsedResponse.script = parsedResponse.script.replace(/^```python\s*|\s*```$/g, '').trim();
        // trim the response
        parsedResponse.response = parsedResponse.response.trim();
        
        // If there's a script to execute, handle it as a tool call
        if (parsedResponse.script) {
          if(onMessage){
              onMessage(completionId, parsedResponse.response);
          }
          yield {
            type: 'text',
            content: parsedResponse.response
          };
          if(!onToolCall){
            throw new Error('onToolCall is not defined');
          }
          const toolCallId = `tool_${Date.now()}`;

          yield {
            type: 'function_call',
            name: 'runCode',
            arguments: {
              code: parsedResponse.script,
            },
            call_id: toolCallId
          };

          // add the tool call to the messages
          messages.push({
            role: 'assistant',
            content: `${parsedResponse.response}\n\nTo help me complete your request, please execute the following code:\n\`\`\`\n${parsedResponse.script}\n\`\`\``
          });

          // Execute the tool call
          const result = await onToolCall({
            name: 'runCode',
            arguments: {
              code: parsedResponse.script,
            },
            call_id: toolCallId
          });

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
        } else {
          if(onMessage){
              onMessage(completionId, parsedResponse.response);
          }
          yield {
              type: 'text',
              content: parsedResponse.response
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
                  const toolCallPromise = onToolCall({
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

        const toolCallPromise = onToolCall({
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