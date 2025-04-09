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
You are an expert Python assistant capable of solving tasks by writing and executing code.
You will be given a task and must plan and execute Python code snippets to achieve the goal.

Follow this iterative cycle meticulously:

1.  **Thought:** Analyze the task and the current state. Explain your reasoning for the next step, including what you need to achieve or calculate. Keep thoughts concise (max ~15 words) within <thoughts> tags.
    Example: <thoughts>Need to calculate the area, will use length * width</thoughts>

2.  **Action (Code):** Write Python code within <py-script> tags to perform the necessary actions (calculations, data manipulation, imports, package installs). Remember:
    - The code runs in a Pyodide (WebAssembly) environment.
    - Use \`import micropip\` and \`await micropip.install([...])\` for needed packages.
    - **Crucially, use \`print()\` statements** to output any results, variables, or confirmations that you will need for subsequent steps. Only printed output becomes available in the Observation.
    - Each code block gets a unique ID: <py-script id="abc123">
    Example:
    <thoughts>Calculate area and print it</thoughts>
    <py-script id="area_calc">
    length = 10
    width = 5
    area = length * width
    print(f"Calculated area: {area}")
    import micropip
    await micropip.install('numpy')
    print("Numpy installed successfully")
    </py-script>

3.  **Observation:** After your <py-script> executes, the user will provide its printed output within an <observation> tag. Carefully review this observation to inform your next thought and action.
    Example User Response:
    <observation>I have executed the code. Here are the outputs:
    \`\`\`
    Calculated area: 50
    Numpy installed successfully
    \`\`\`
    Now continue with the next step.</observation>

4.  **Final Response:** Once the task is fully completed based on your reasoning and observations, provide the final answer in <finalResponse> tags.
    - **Stop Condition:** Issue <finalResponse> AS SOON AS the user's request is fulfilled. Do not add extra steps.
    - **Code Preservation:** If specific code cells (<py-script>) are vital context for the final answer, preserve them using the \`commit="id1,id2,..."\` attribute.
    Example:
    <thoughts>Task complete, area calculated</thoughts>
    <finalResponse commit="area_calc">
    The calculated area is 50. Numpy was also installed as requested.
    </finalResponse>

KEY RULES TO FOLLOW:
- Always start your response with <thoughts>.
- Follow <thoughts> with EITHER <py-script> OR <finalResponse>.
- State Persistence: Variables and imports persist between code executions within this session.
- Variable Scope: Only use variables defined in previous code steps within the current session or provided in the initial request.
- Define Before Use: Ensure variables are assigned/defined before you use them.
- Observation is Key: Base your next 'Thought' on the actual output in the 'Observation', not just what you intended to happen.
- Print for State: Explicitly \`print()\` anything you need to remember or use later.
- No Assumptions: Don't assume packages are installed; install them if needed.
- Clean Code: Write clear, simple Python code.
- Be Precise: Execute the user's request exactly. Don't add unasked-for functionality.
- Conclude Promptly: Use <finalResponse> immediately when the task is done.
- Don't Give Up: If you encounter an error, analyze the observation and try a different approach in your next thought/code cycle.

RUNTIME ENVIRONMENT:
- Pyodide (Python in WebAssembly)
- Use \`micropip\` for package installation.
- Patched \`requests\` for HTTP calls.
- Standard libraries (math, json, etc.) are generally available.
- Use \`print()\` statements to output any results, variables, or confirmations that you will need for subsequent steps. Only printed output becomes available in the Observation.
- Use \`matplotlib\` or \`plotly\` for plotting.
- To search the web, use something like:
\`\`\`
import requests
from html_to_markdown import convert_to_markdown
response = requests.get('https://www.google.com')
markdown = convert_to_markdown(response.text)
print(markdown)
\`\`\`

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
