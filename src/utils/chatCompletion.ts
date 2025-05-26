import OpenAI from 'openai';

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

export interface AgentSettings {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
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

const RESPONSE_INSTRUCTIONS = `
You are capable of solving tasks by writing and executing Python code.
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

4.  **Final Response:** Use <returnToUser> tags to conclude the current round of conversation and return control to the user. This should be used when:
    - The task is fully completed based on your reasoning and observations
    - You need more input from the user to proceed further
    - You've reached a logical stopping point in the conversation
    - You want to provide an interim result or update to the user

    - **Code and output Preservation:** If specific code cells (<py-script>) are vital context for the final answer, preserve them using the \`commit="id1,id2,..."\` attribute.
    Example:
    <thoughts>Task complete, area calculated</thoughts>
    <returnToUser commit="area_calc">
    The calculated area is 50. Numpy was also installed as requested.
    </returnToUser>
    - **Always commit key code and outputs (images, plots etc.):**: Importantly, all the uncommitted code and output are discarded, and the user and subsequent steps will not be able to see them.

KEY RULES TO FOLLOW:
- Always start your response with <thoughts>.
- Follow <thoughts> with EITHER <py-script> OR <returnToUser>.
- State Persistence: Variables and imports persist between code executions within this session.
- Variable Scope: Only use variables defined in previous code steps within the current session or provided in the initial request.
- Define Before Use: Ensure variables are assigned/defined before you use them.
- Observation is Key: Base your next 'Thought' on the actual output in the 'Observation', not just what you intended to happen.
- Print for State: Explicitly \`print()\` anything you need to remember or use later.
- No Assumptions: Don't assume packages are installed; install them if needed.
- Clean Code: Write clear, simple Python code.
- Be Precise: Execute the user's request exactly. Don't add unasked-for functionality.
- Return to User: Use <returnToUser commit="id1,id2,..."> when you need to conclude the current round of conversation, commit code and outputs, and return control to the user. This includes when the task is complete, when you need more information, or when you've reached a logical stopping point.
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

INTERNAL API ACCESS:
- You have access to an \`api\` object to call pre-defined internal functions.
- Example (Vision): Use \`await api.inspectImages(images=[{'url': 'data:image/png;base64,...'}], query='Describe this image')\` to visually inspect images under certain context using vision-capable models.
- Example (Chat): Use \`await api.chatCompletion(messages=[{'role': 'system', 'content': 'You are a helpful assistant.'}, {'role': 'user', 'content': 'Hello! How are you?'}], max_tokens=50)\` to perform a direct chat completion using the agent's configured model and settings. It takes a list of messages (including optional system messages) and optional max_tokens.
- Example (Chat with JSON Schema): Use \`await api.chatCompletion(messages=[{'role': 'user', 'content': 'Extract the name and age from this text: John Doe is 30 years old.'}], response_format={type: 'json_schema', json_schema: {name: 'user_info', schema: {type: 'object', properties: {name: {type: 'string'}, age: {type: 'integer'}}, required: ['name', 'age']}}})\` to force the chat response into a specific JSON structure.

IMAGE ENCODING EXAMPLE (NumPy to Base64 for API):
\`\`\`python
<thoughts>Need to encode a NumPy array image to base64 and inspect it.</thoughts>
<py-script id="img_encode_inspect">
import numpy as np
import base64
from io import BytesIO
from PIL import Image # Assuming PIL is available or installed

# Create a dummy numpy array (replace with your actual image data)
img_array = np.random.randint(0, 256, (100, 100, 3), dtype=np.uint8)

# Convert numpy array to PIL Image
pil_img = Image.fromarray(img_array)

# Save PIL image to a bytes buffer
buffer = BytesIO()
pil_img.save(buffer, format="PNG") # Or JPEG, etc.

# Encode bytes buffer to base64
base64_encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')

# Create the data URL
data_url = f"data:image/png;base64,{base64_encoded}"

# --- Now you can use data_url with api.inspectImages ---
# Example (will be executed by the system if api is available):
# await api.inspectImages(images=[{'url': data_url}], query='Describe this generated image.')
# Optionally, pass a JSON schema to force the output to follow a specific schema:
# await api.inspectImages(images=[{'url': data_url}], query='find the bounding box of the image', outputSchema={...})

# Print the data URL (or parts of it) if needed for observation
print(f"Generated data URL (truncated): {data_url[:50]}...")
print("Image encoded successfully.")

</py-script>
\`\`\`

`;

// Update defaultAgentConfig to use the AgentSettings interface
export const DefaultAgentConfig: AgentSettings = {
    baseURL: 'http://localhost:11434/v1/',
    apiKey: 'ollama',
    model: 'qwen2.5-coder:7b',
    temperature: 0.7,
  };

// Helper function to extract final response from script
interface ReturnToUserResult {
  content: string;
  properties: Record<string, string>;
}

function extractReturnToUser(script: string): ReturnToUserResult | null {
  // Match <returnToUser> with optional attributes, followed by content, then closing tag
  const match = script.match(/<returnToUser(?:\s+([^>]*))?>([\s\S]*?)<\/returnToUser>/);
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

export async function* chatCompletion({
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
  type: 'text' | 'function_call' | 'function_call_output' | 'new_completion' | 'error';
  content?: string;
  name?: string;
  arguments?: any;
  call_id?: string;
  completion_id?: string;
  error?: Error;
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
      try {
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

          console.error('Error processing streaming response:', error);
          yield {
            type: 'error',
            content: `Error processing response: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error : new Error('Unknown error processing response')
          };
          return; // Exit generator on stream processing error
        }
      } catch (error) {
        console.error('Error connecting to LLM API:', error);
        let errorMessage = 'Failed to connect to the language model API';

        // Check for specific OpenAI API errors
        if (error instanceof Error) {
          // Handle common API errors
          if (error.message.includes('404')) {
            errorMessage = `Invalid model endpoint: ${baseURL} or model: ${model}`;
          } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage = `Authentication error: Invalid API key`;
          } else if (error.message.includes('429')) {
            errorMessage = `Rate limit exceeded. Please try again later.`;
          } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
            errorMessage = `Connection timeout. The model endpoint (${baseURL}) may be unavailable.`;
          } else {
            errorMessage = `API error: ${error.message}`;
          }
        }

        yield {
          type: 'error',
          content: errorMessage,
          error: error instanceof Error ? error : new Error(errorMessage)
        };
        return; // Exit generator on API error
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

        // Check if this is a final response - if so, we should stop the loop and return control to the user
        const returnToUser = extractReturnToUser(accumulatedResponse);
        if (returnToUser) {
          if(onMessage){
              // Extract commit IDs from properties and pass them as an array
              const commitIds = returnToUser.properties.commit ?
                returnToUser.properties.commit.split(',').map(id => id.trim()) :
                [];

              onMessage(completionId, returnToUser.content, commitIds);
          }
          yield {
            type: 'text',
            content: returnToUser.content
          };
          // Exit the loop since we have a final response that concludes this round of conversation
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
          try {
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
          } catch (error) {
            console.error('Error executing code:', error);
            const errorMessage = `Error executing code: ${error instanceof Error ? error.message : 'Unknown error'}`;

            yield {
              type: 'error',
              content: errorMessage,
              error: error instanceof Error ? error : new Error(errorMessage)
            };

            // Add error message to messages so the model can attempt recovery
            messages.push({
              role: 'user',
              content: `<observation>Error executing the code: ${error instanceof Error ? error.message : 'Unknown error'}\nPlease try a different approach.</observation>`
            });
          }
        }
        else{
          // if no <thoughts> or <py-script> tag produced
          messages.push({
            role: 'assistant',
            content: `<thoughts>${accumulatedResponse} (Reminder: I need to use \`py-script\` tag to execute script or \`returnToUser\` tag with commit property to conclude the session)</thoughts>`
          });
        }
        // add a reminder message if we are approaching the max steps
        if(loopCount >= maxSteps - 2){
          messages.push({
            role: 'user',
            content: `You are approaching the maximum number of steps (${maxSteps}). Please conclude the session with \`returnToUser\` tag and commit the current code and outputs, otherwise the session will be aborted.`
          });
        }

        // Check if we've hit the loop limit
        if (loopCount >= maxSteps) {
          console.warn(`Chat completion reached maximum loop limit of ${maxSteps}`);
          if(onMessage){
            onMessage(completionId, `<thoughts>Maximum steps reached</thoughts>\n<returnToUser>Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. I'm returning control to you now. Please try breaking your request into smaller steps or provide additional guidance.</returnToUser>`, []);
          }
          yield {
            type: 'text',
            content: `<thoughts>Maximum steps reached</thoughts>\n<returnToUser>Reached maximum number of tool calls (${maxSteps}). Some actions may not have completed. I'm returning control to you now. Please try breaking your request into smaller steps or provide additional guidance.</returnToUser>`
          };
          break;
        }
      } catch (error: unknown) {
        console.error('Error parsing or processing response:', error);
        let errorMessage = 'Failed to process the model response';

        if (error instanceof Error) {
          errorMessage = `Error: ${error.message}`;
        }

        yield {
          type: 'error',
          content: errorMessage,
          error: error instanceof Error ? error : new Error(errorMessage)
        };

        // Try to add a message to recover if possible
        messages.push({
          role: 'user',
          content: `<observation>Error in processing: ${errorMessage}. Please try again with a simpler approach.</observation>`
        });
      }
    }
  } catch (err) {
    console.error('Error in structured chat completion:', err);
    const errorMessage = `Chat completion error: ${err instanceof Error ? err.message : 'Unknown error'}`;

    yield {
      type: 'error',
      content: errorMessage,
      error: err instanceof Error ? err : new Error(errorMessage)
    };
  }
}
