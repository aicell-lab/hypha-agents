import OpenAI from 'openai';
import { Tool } from '../components/chat/ToolProvider';

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
  tools?: Tool[];
  model?: string;
  temperature?: number;
  server: any;
  onToolCall?: (toolCall: any) => Promise<string>;
  maxSteps?: number; // Maximum number of tool call steps before stopping
}

export async function* chatCompletion({
  messages,
  systemPrompt,
  tools,
  model = 'gpt-4o-mini',
  temperature = 0.7,
  server,
  onToolCall,
  maxSteps = 10, // Default to 10 loops
}: ChatCompletionOptions): AsyncGenerator<{
  type: 'text' | 'function_call' | 'function_call_output' | 'new_completion';
  content?: string;
  name?: string;
  arguments?: any;
  call_id?: string;
}, void, unknown> {
  try {
    // Get OpenAI API key from schema-agents service
    const schemaAgents = await server.getService("schema-agents");
    const session = await schemaAgents?.get_openai_token();
    const API_KEY = session.client_secret.value;

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: API_KEY,
      dangerouslyAllowBrowser: true
    });

    // Format tools for OpenAI function calling format
    const formattedTools = tools?.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    })) || [];

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

      // Create streaming completion
      const stream = await openai.chat.completions.create({
        model,
        messages: fullMessages as OpenAI.Chat.ChatCompletionMessageParam[],
        tools: formattedTools,
        tool_choice: 'auto',
        temperature,
        stream: true
      });

      // Process the stream
      let accumulatedResponse = '';
      let currentToolCall: any = null;
      let hasToolCalls = false;

      yield {
        type: 'new_completion',
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