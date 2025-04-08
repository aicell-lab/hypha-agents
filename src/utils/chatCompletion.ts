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
  onExecuteCode?: (completionId: string, scriptContent: string) => Promise<string>;
  onMessage?: (completionId: string, message: string, commitIds?: string[]) => void;
  onStreaming?: (completionId: string, message: string) => void;
  maxSteps?: number; // Maximum number of tool call steps before stopping
  baseURL?: string; // Base URL for the API
  apiKey?: string; // API key for authentication
  stream?: boolean;
  abortController?: AbortController; // Add abortController to options
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

Then it MUST followed by one of the following tags:
1. Python code to execute (wrapped in <py-script> tags), or
2. A final response (wrapped in <finalResponse> tags)

RUNTIME ENVIRONMENT:
- Code runs in a Jupyter notebook-like environment in the browser using Pyodide (WebAssembly)
- Most common Python libraries are pre-installed
- To install new packages use micropip:
  import micropip
  await micropip.install(['package1', 'package2'])
- HTTP requests can be made using the patched 'requests' module as normal
- Some system-level or binary-dependent packages may not be available

IMPORTANT NOTE ON CODE EXECUTION:
- All intermediate py-script code blocks will be DISCARDED unless explicitly committed
- To preserve code cells, use the commit property in your final response: <finalResponse commit="id1,id2,...">
- Only code cells with IDs listed in the commit property will be kept
- Temporary debugging code or code with errors will be removed automatically
- Each code block gets a unique ID, visible in the XML tag: <py-script id="abc123">

Example responses:

When executing code:
<thoughts>Plotting sine wave with numpy</thoughts>
<py-script id="123">
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
</py-script>

When providing a final response:
<thoughts>Explaining the sine plot</thoughts>
<finalResponse commit="123">
I've created a basic sine wave plot. The graph shows one complete cycle of the sine function from 0 to 2π. The wave oscillates between -1 and 1 on the y-axis. Would you like to modify any aspects of the plot?
</finalResponse>

INTERACTION GUIDELINES:

1. RESPONSE FORMAT
   - ALWAYS start with <thoughts> tag (max 5 words)
   - For actions: Use <py-script> tags with Python code
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
   - Install required packages using micropip when needed
   - Use commit property to preserve important code: <finalResponse commit="id1,id2">
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
interface FinalResponseResult {
  content: string;
  properties: Record<string, string>;
}

function extractFinalResponse(script: string): FinalResponseResult | null {
  // Match <finalResponse> with optional attributes, followed by content, then closing tag
  const match = script.match(/<finalResponse(?:\s+([^>]*))?>([\s\S]*?)<\/finalResponse>/);
  if (!match) return null;

  // Extract properties from attributes if they exist
  const properties: Record<string, string> = {};
  const [, attrs, content] = match;
  
  if (attrs) {
    // Match all key="value" or key='value' pairs
    const propRegex = /(\w+)=["']([^"']*)["']/g;
    let propMatch;
    while ((propMatch = propRegex.exec(attrs)) !== null) {
      const [, key, value] = propMatch;
      properties[key] = value;
    }
  }

  return {
    content: content.trim(),
    properties
  };
}

// Helper function to extract thoughts from script
function extractThoughts(script: string): string | null {
  const match = script.match(/<thoughts>([\s\S]*?)<\/thoughts>/);
  return match ? match[1].trim() : null;
}

// Helper function to extract script content
function extractScript(script: string): string | null {
  // Match <py-script> with optional attributes, followed by content, then closing tag
  const match = script.match(/<py-script(?:\s+[^>]*)?>([\s\S]*?)<\/py-script>/);
  return match ? match[1].trim() : null;
}

export async function* structuredChatCompletion({
  messages,
  systemPrompt,
  model = 'qwen2.5-coder:7b',
  temperature = 0.7,
  onExecuteCode,
  onMessage,
  onStreaming,
  maxSteps = 10,
  baseURL = 'http://localhost:11434/v1/',
  apiKey = 'ollama',
  stream = true,
  abortController, // Add abortController parameter
}: ChatCompletionOptions): AsyncGenerator<{
  type: 'text' | 'function_call' | 'function_call_output' | 'new_completion';
  content?: string;
  name?: string;
  arguments?: any;
  call_id?: string;
  completion_id?: string;
}, void, unknown> {
  try {
    // Create a new AbortController if one wasn't provided
    const controller = abortController || new AbortController();
    const { signal } = controller;
    
    systemPrompt = (systemPrompt || '') + RESPONSE_INSTRUCTIONS;
    const openai = new OpenAI({
      baseURL,
      apiKey,
      dangerouslyAllowBrowser: true
    });

    let loopCount = 0;
    
    while (loopCount < maxSteps) {
      // Check if abort signal was triggered
      if (signal.aborted) {
        console.log('Chat completion aborted by user');
        return;
      }
      
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

      // Create standard completion stream with abort signal
      const completionStream: any = await openai.chat.completions.create(
        {
          model,
          messages: fullMessages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature,
          stream: stream,
        },
        { 
          signal // Pass the abort signal as part of the request options
        }
      );

      // Process the stream and accumulate JSON
      try {
        for await (const chunk of completionStream) {
          // Check if abort signal was triggered during streaming
          if (signal.aborted) {
            console.log('Chat completion stream aborted by user');
            return;
          }
          
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
      } catch (error) {
        // Check if error is due to abortion
        if (signal.aborted) {
          console.log('Stream processing aborted by user');
          return;
        }
        throw error; // Re-throw for other errors
      }

      // Parse and validate the accumulated JSON
      try {
        // Check if abort signal was triggered after streaming
        if (signal.aborted) {
          console.log('Chat completion parsing aborted by user');
          return;
        }
       
        // Extract thoughts for logging
        const thoughts = extractThoughts(accumulatedResponse);
        if (thoughts) {
          console.log('Thoughts:', thoughts);
        }

        // Check if this is a final response - if so, we should stop the loop
        const finalResponse = extractFinalResponse(accumulatedResponse);
        if (finalResponse) {
          if(onMessage){
              // Extract commit IDs from properties and pass them as an array
              const commitIds = finalResponse.properties.commit ? 
                finalResponse.properties.commit.split(',').map(id => id.trim()) : 
                [];
              
              onMessage(completionId, finalResponse.content, commitIds);
          }
          yield {
            type: 'text',
            content: finalResponse.content
          };
          // Exit the loop since we have a final response
          return;
        }
        
        // Handle script execution
        if(!onExecuteCode){
          throw new Error('onExecuteCode is not defined');
        }


        // Extract script content if it exists
        const scriptContent = extractScript(accumulatedResponse);
        if (scriptContent) {
          // Check if abort signal was triggered before tool execution
          if (signal.aborted) {
            console.log('Chat completion tool execution aborted by user');
            return;
          }
          
          yield {
            type: 'function_call',
            name: 'runCode',
            arguments: {
              code: scriptContent,
            },
            call_id: completionId
          };

          // Add the tool call to messages with XML format
          messages.push({
            role: 'assistant',
            content: `<thoughts>${thoughts}</thoughts>\n<py-script id="${completionId}">${scriptContent}</py-script>`
          });

          // on Streaming about executing the code
          if(onStreaming){
            onStreaming(completionId, `Executing code...`);
          }

          // Execute the tool call
          const result = await onExecuteCode(
            completionId,
            scriptContent
          );

          // Yield the tool call output
          yield {
            type: 'function_call_output',
            content: result,
            call_id: completionId
          };

          // Add tool response to messages
          messages.push({
            role: 'user',
            content: `<observation>I have executed the code. Here are the outputs:\n\`\`\`\n${result}\n\`\`\`\nNow continue with the next step.</observation>`
          });
        }
        else{
          // if no <thoughts> or <py-script> tag produced
          messages.push({
            role: 'assistant',
            content: `<thoughts>${accumulatedResponse} (Reminder: I need to use \`py-script\` tag to execute script or \`finalResponse\` tag to conclude the session)</thoughts>`
          });
        }

        // Check if we've hit the loop limit
        if (loopCount >= maxSteps) {
          console.warn(`Chat completion reached maximum loop limit of ${maxSteps}`);
          if(onMessage){
            onMessage(completionId, `<thoughts>Maximum steps reached</thoughts>\n<finalResponse>Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. Please try breaking your request into smaller steps.</finalResponse>`, []);
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
