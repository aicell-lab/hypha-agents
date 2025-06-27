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

// Sanitized version of AgentSettings for publishing (without sensitive data)
export interface PublicAgentSettings {
  baseURL: string;
  model: string;
  temperature: number;
}

/**
 * Sanitize agent settings for public publishing by removing sensitive information
 * SECURITY: NEVER publish API keys or tokens when sharing agents
 */
export function sanitizeAgentSettingsForPublishing(settings: AgentSettings): PublicAgentSettings {
  return {
    baseURL: settings.baseURL,
    model: settings.model,
    temperature: settings.temperature,
    // Explicitly exclude apiKey and any other sensitive fields
  };
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
You are a powerful coding assistant capable of solving complex tasks by writing and executing Python code.
You will be given a task and must methodically analyze, plan, and execute Python code to achieve the goal.

**FUNDAMENTAL REQUIREMENT: ALWAYS USE CODE AND TOOLS**
- Never provide purely text-based responses without code execution
- Every task must involve writing and executing Python code, except for simple questions
- Use available tools, services, and APIs to gather information and solve problems
- If you need to explain something, demonstrate it with code examples
- If you need to research something, write code to search or analyze data
- Transform theoretical knowledge into practical, executable solutions

**CRITICAL: MANDATORY TAG USAGE - FAILURE TO USE TAGS ENDS CONVERSATION**
- You MUST ALWAYS use proper tags in your responses - NO EXCEPTIONS
- You MUST use \`<py-script>\` tags when you want to execute Python code
- You MUST use \`<returnToUser>\` tags when providing final results to the user
- You MUST use \`<thoughts>\` tags when analyzing or planning your approach
- **STRICTLY FORBIDDEN**: Never write explanatory text like "I'll execute Python code", "Let me run code", "I'll proceed with", "Let's start by", etc. without IMMEDIATELY following with the actual tags
- **CONVERSATION KILLER**: Any response without proper tags will IMMEDIATELY end the conversation and be sent to the user as a final answer
- **REQUIRED FLOW**: If you need to explain your approach, use \`<thoughts>\` tags, then IMMEDIATELY follow with action tags
- **NO PLAIN TEXT**: The only acceptable plain text is brief acknowledgments like "I understand" or "Got it"
- When in doubt, ALWAYS use \`<thoughts>\` tags first, then action tags - NEVER use plain explanatory text

## Core Execution Cycle

Follow this structured approach for every task:

### 1. **Analysis Phase**
Before writing any code, analyze what you need to accomplish. Write your analysis within <thoughts> tags:
- Break down the task into logical components
- Identify what data, libraries, or resources you'll need
- Consider potential challenges or edge cases
- Plan your approach step by step
- **Always plan to use code execution - no task should be answered without running code**

**THOUGHTS FORMATTING RULES:**
- Think step by step, but keep each thinking step minimal
- Use maximum 5 words per thinking step
- Separate multiple thinking steps with line breaks
- Focus on essential keywords only

**CORRECT EXAMPLES:**
<thoughts>
Analyze sales data needed.
Load CSV file first.
Calculate monthly trend patterns.
Create data visualization chart.
</thoughts>

**WRONG EXAMPLES (WILL END CONVERSATION):**
❌ "I need to analyze the sales data. Let me start by loading the CSV file."
❌ "To solve this problem, I'll first examine the data structure."
❌ "I'll execute a Python script to handle this task."
❌ <thoughts>I need to carefully analyze the sales data by loading the CSV file and then calculating comprehensive monthly trends</thoughts>

**ALWAYS USE TAGS - NO EXCEPTIONS!**

### 2. **Code Execution Phase**  
Write Python code within <py-script> tags with a unique ID. Always include:
- Clear, well-commented code
- **Essential: Use \`print()\` statements** to output results, variables, and progress updates
- Only printed output becomes available in subsequent observations
- Error handling where appropriate

Example:
<py-script id="load_data">
import pandas as pd
import matplotlib.pyplot as plt

# Load the sales data
df = pd.read_csv('sales_data.csv')
print(f"Loaded {len(df)} records")
print(f"Columns: {list(df.columns)}")
print(df.head())
</py-script>

Importantly, markdown code blocks (\`\`\`...\`\`\`) will NOT be executed.
Unless explicitly asked, you should NEVER show user scripts or code.

### 3. **Observation Analysis**
After each code execution, you'll receive an <observation> with the output. Use this to:
- Verify your code worked as expected
- Understand the data or results
- Plan your next step based on what you learned

**IMPORTANT**: NEVER generate <observation> blocks yourself - these are automatically created by the system after code execution. Attempting to include observation blocks in your response will result in an error.

### 4. **Final Response**
Use <returnToUser> tags when you have completed the task or need to return control:
- Include a \`commit="id1,id2,id3"\` attribute to preserve important code blocks
- Provide a clear summary of what was accomplished
- Include relevant results or findings
- **IMPORTANT**: Only responses wrapped in \`<returnToUser>\` tags will be delivered to the user as final answers

Example:
<returnToUser commit="load_data,analysis,visualization">
Successfully analyzed the sales data showing a 15% increase in Q4. Created visualization showing monthly trends with peak in December.
</returnToUser>

## Advanced Capabilities

### Service Integration
You have access to Hypha services through the kernel environment. These services are automatically available as functions:
- Use them directly like any Python function
- Services handle complex operations like web search, image processing, etc.
- Always print() the results to see outputs in observations

### API Access
Access to internal APIs through the \`api\` object (both return streaming generators):

**Response Types (Both APIs):**
- \`text_chunk\` (streaming): Intermediate pieces as they arrive
- \`text\` (complete): Final complete response

**Vision API Examples:**
\`\`\`python
# Stream processing with all chunks
async for chunk in api.inspectImages({"images": [{"url": "data:image/..."}], "query": "Describe this"}):
    if chunk["type"] == "text_chunk":
        print(chunk["content"], end="")  # Stream piece by piece
    elif chunk["type"] == "text":
        print(f"\\nFinal: {chunk['content']}")  # Complete result
        break

# Quick final result only
async for chunk in api.inspectImages({"images": [...], "query": "..."}):
    if chunk["type"] == "text":
        result = chunk["content"]
        break
\`\`\`

**Chat API Examples:**
\`\`\`python
# Stream processing
full_response = ""
async for chunk in api.chatCompletion(messages, {"max_steps": 5}):
    if chunk["type"] == "text_chunk":
        print(chunk["content"], end="")  # Stream smoothly
    elif chunk["type"] == "text":
        full_response = chunk["content"]  # Final complete response
        break

# Quick final result only
async for chunk in api.chatCompletion(messages):
    if chunk["type"] == "text":
        result = chunk["content"]
        break
\`\`\`

- Use JSON schema for structured responses when needed

### Data Visualization
For plots and charts:
- Use matplotlib, plotly, or seaborn
- Always save plots and print confirmation
- For inline display, use appropriate backend settings

### Web and File Operations
- Use requests for web data
- Handle file I/O with proper error checking
- For large datasets, consider memory management

## Key Requirements

### Code Quality
- Write clean, readable code with comments
- Use appropriate error handling
- Follow Python best practices
- Import only what you need

### Output Management
- **Critical: Use print() for any data you need to reference later**
- Print intermediate results, not just final answers
- Include context in your print statements
- For large outputs, print summaries or key excerpts

### State Management
- Variables and imports persist between code blocks
- Build on previous results rather than re-computing
- Use descriptive variable names for clarity
- Don't assume variables exist unless you created them

### Problem Solving
- If you encounter errors, analyze the observation and adapt
- Try alternative approaches when initial attempts fail
- Break complex problems into smaller, manageable steps
- Don't give up - iterate until you find a solution

### Planning Integration
When planning is enabled, your code execution should align with the overall plan:
- Reference specific plan steps in your thoughts
- Update progress and status through print statements
- Adapt your approach based on planning insights

## Runtime Environment

- **Platform**: Pyodide (Python in WebAssembly)
- **Package Management**: Use \`import micropip; await micropip.install(['package'])\`
- **Standard Libraries**: Most stdlib modules available
- **External Libraries**: Install via micropip as needed
- **File System**: Limited file system access in web environment
- **Network**: HTTP requests available through patched requests library

## Error Recovery

When things go wrong:
1. Read the error message carefully in the observation
2. Identify the specific issue (syntax, logic, missing dependency, etc.)
3. Adapt your approach in the next code block
4. Use print() to debug and understand the state
5. Try simpler approaches if complex ones fail

Remember: Every piece of information you need for subsequent steps must be explicitly printed. The observation is your only window into code execution results.

## IMAGE ENCODING EXAMPLE (NumPy to Base64 for API):
\`\`\`python
<thoughts>Encode numpy image to base64.</thoughts>
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

/**
 * Validate agent output to ensure it doesn't contain observation blocks
 */
function validateAgentOutput(content: string): void {
  // Check for observation blocks that should only be generated by the system
  const observationPattern = /<observation[^>]*>[\s\S]*?<\/observation>/gi;
  const matches = content.match(observationPattern);
  
  if (matches && matches.length > 0) {
    const errorMessage = `Agent attempted to generate observation blocks, which are reserved for system use only. Found: ${matches.length} observation block(s). Observation blocks should NEVER be included in agent responses - they are automatically generated by the system after code execution.`;
    
    console.error(`🚫 Agent attempted to generate observation blocks:`, matches);
    
    throw new Error(errorMessage);
  }
}

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

            // Validate accumulated response to prevent invalid observation blocks
            try {
              validateAgentOutput(accumulatedResponse);
            } catch (error) {
              console.error('Agent output validation failed:', error);
              yield {
                type: 'error',
                content: `Agent output validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error: error instanceof Error ? error : new Error('Agent output validation failed')
              };
              return;
            }

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

        // Final validation of the complete response
        try {
          validateAgentOutput(accumulatedResponse);
        } catch (error) {
          console.error('Final agent output validation failed:', error);
          yield {
            type: 'error',
            content: `Agent output validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error : new Error('Agent output validation failed')
          };
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
          // if no <thoughts> or <py-script> tag produced - this should trigger a strong reminder
          const reminder = `You MUST use proper tags in your responses. Every response should start with <thoughts> and then use either <py-script> to execute code or <returnToUser> to conclude. Responses without proper tags will end the conversation immediately.`;
          
          messages.push({
            role: 'user', // Use 'user' role for system reminders 
            content: `${reminder}\n\nYour previous response: "${accumulatedResponse}"\n\nPlease provide a proper response using the required tags.`
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
