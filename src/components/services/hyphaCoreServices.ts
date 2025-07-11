import { HyphaCore } from 'hypha-core';
import { inspectImages, ImageInfo } from '../../utils/visionInspection';
import { AgentSettings, ChatMessage } from '../../utils/chatCompletion';
import OpenAI from 'openai';
import { JSONSchema } from 'openai/lib/jsonschema';

// Define a type for the schema details when type is 'json_schema'
type JsonSchemaDetails = {
    name: string;
    description?: string;
    strict?: boolean;
    schema: Record<string, unknown>; // Match SDK expectation
}

// Types
interface HyphaCoreWindow {
  id: string;
  src: string;
  name?: string;
}

interface HyphaCoreService {
  id: string;
  name: string;
  description: string;
  config: {
    require_context: boolean;
  };
  inspectImages?: (options: {
    images: ImageInfo[];
    query: string;
    contextDescription: string;
    outputSchema?: JSONSchema;
  }) => Promise<string | any>;
  chatCompletion?: (options: {
    messages: ChatMessage[];
    max_tokens?: number;
    response_format?: 
      | { type: "text" }
      | { type: "json_object" }
      | { type: "json_schema"; json_schema: JsonSchemaDetails }; // Updated definition
  }) => Promise<string | any>;
}

interface SetupNotebookServiceProps {
  onAddWindow: (config: HyphaCoreWindow) => void;
  server: any;
  executeCode: (code: string, options?: any) => Promise<any>;
  agentSettings: AgentSettings;
  abortSignal?: AbortSignal;
  projectId: string;
}

// Store the HyphaCore instance and API promise globally
declare global {
  interface Window {
    _hyphaCorePromise?: {
      instance: HyphaCore;
      api: Promise<any>;
    };
  }
}

// Function to check if a model is vision capable
const isVisionModel = (modelName: string): boolean => {
  return /gpt-[45]|llava/i.test(modelName);
};

// Setup notebook service
export const setupNotebookService = async ({
  onAddWindow,
  server,
  executeCode,
  agentSettings,
  abortSignal,
  projectId,
}: SetupNotebookServiceProps) => {
  // Initialize or get the existing HyphaCore promise
  if (!window._hyphaCorePromise) {
    const instance = new HyphaCore();
    const api = instance.start();
    window._hyphaCorePromise = { instance, api };
  }

  // Register the event handler on the instance
  // Note: HyphaCore doesn't have an 'off' method, so we directly register the handler
  // Multiple registrations will override the previous handler
  window._hyphaCorePromise.instance.on("add_window", onAddWindow);

  console.log("Setting up notebook service with agent settings:", agentSettings);
  try {
    // Await the API promise
    const api = await window._hyphaCorePromise.api;
    
    const service: HyphaCoreService = {
      "id": "hypha-core",
      "name": "Hypha Core",
      "description": "Hypha Core service",
      "config": {
        "require_context": false,
      },
      inspectImages: async (options: {
        images: ImageInfo[];
        query: string;
        contextDescription: string;
        outputSchema?: JSONSchema;
      }): Promise<string | any> => {
        if (!isVisionModel(agentSettings.model)) {
          return `Error: Model '${agentSettings.model}' does not support vision capabilities. Please use a vision-capable model like gpt-4o, gpt-4-vision, or llava.`;
        }

        console.log("inspectImages called with outputSchema:", !!options.outputSchema);
        if (options.outputSchema) {
          console.log("outputSchema keys:", Object.keys(options.outputSchema));
        }

        try {
          const result = await inspectImages({
            ...options,
            model: agentSettings.model,
            baseURL: agentSettings.baseURL,
            apiKey: agentSettings.apiKey,
            outputSchema: options.outputSchema,
          });
          
          console.log("inspectImages result type:", typeof result);
          console.log("inspectImages result:", result);
          
          return result;
        } catch (error) {
          console.error("Error in inspectImages wrapper:", error);
          // Re-throw the error instead of converting to string
          throw error;
        }
      },
      chatCompletion: async (options: {
        messages: ChatMessage[];
        max_tokens?: number;
        response_format?: 
          | { type: "text" }
          | { type: "json_object" }
          | { type: "json_schema"; json_schema: JsonSchemaDetails }; // Updated definition
      }): Promise<string | any> => {
        const { messages, max_tokens = 1024, response_format } = options;

        const openai = new OpenAI({
          apiKey: agentSettings.apiKey,
          baseURL: agentSettings.baseURL,
          dangerouslyAllowBrowser: true
        });

        // Explicitly type the params object
        const completionParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
            model: agentSettings.model,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            max_tokens: max_tokens,
            stream: false, // Ensure stream is explicitly false for NonStreaming type
        };

        // Conditionally add the response_format based on the refined type
        if (response_format) {
            if (response_format.type === 'json_schema') {
                // Type guard ensures response_format.json_schema is JsonSchemaDetails here
                completionParams.response_format = {
                    type: 'json_schema',
                    json_schema: response_format.json_schema // Pass the whole details object
                };
            } else {
                // Handles 'text' and 'json_object'
                completionParams.response_format = { type: response_format.type };
            }
        }

        try {
          // Pass the constructed params object
          const response = await openai.chat.completions.create(completionParams);

          const content = response.choices[0]?.message?.content || "No response generated";

          // Parse JSON if response_format is json_object or json_schema
          if (response_format && (response_format.type === 'json_object' || response_format.type === 'json_schema')) {
            try {
              return JSON.parse(content);
            } catch (parseError) {
              console.error("Failed to parse JSON response:", parseError);
              throw new Error(`Error parsing JSON response: ${content}`);
            }
          }

          return content;
        } catch (error) {
          console.error("Error in chat completion:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          return `Error during chat completion: ${errorMessage}`;
        }
      },
    };

    // Add other API methods to service with abort signal support
    for (const key of Object.keys(api)) {
      if ((service as any)[key] === undefined) {
        if (typeof api[key] === 'function') {
          (service as any)[key] = async (...args: any[]) => {
            console.log(`Calling ${key} with args`, args);
            
            // Create a wrapper Promise that can be aborted
            return new Promise(async (resolve, reject) => {
              try {
                // Add abort signal handler
                if (abortSignal) {
                  abortSignal.addEventListener('abort', () => {
                    reject(new Error('Operation cancelled by user'));
                  });
                  
                  // If already aborted, reject immediately
                  if (abortSignal.aborted) {
                    reject(new Error('Operation cancelled by user'));
                    return;
                  }
                }
                
                const result = await api[key](...args);
                resolve(result);
              } catch (error) {
                reject(error);
              }
            });
          };
        } else {
          (service as any)[key] = api[key];
        }
      }
    }

    const svc = await server.registerService(service, { overwrite: true });
    console.log(`Notebook service registered with id ${svc.id}`);
    
    const token = await server.generateToken();
    await executeCode(`import micropip
await micropip.install(['numpy', 'nbformat', 'pandas', 'matplotlib', 'plotly', 'hypha-rpc', 'pyodide-http'])
import pyodide_http
pyodide_http.patch_all()
%matplotlib inline

from hypha_rpc import connect_to_server
server = await connect_to_server(server_url="${server.config.public_base_url}", token="${token}")
api = await server.get_service("${svc.id}")
print("Hypha Core service connected in kernel.")

# Set environment variables
import os
os.environ['CURRENT_URL'] = '${window.location.href}'
os.environ['CURRENT_URL'] = '${window.location.href}'
os.environ['HYPHA_SERVER_URL'] = '${server.config.public_base_url}'
os.environ['HYPHA_WORKSPACE'] = '${server.config.workspace}'
os.environ['HYPHA_TOKEN'] = '${token}'
os.environ['HYPHA_PROJECT_ID'] = '${projectId}'
os.environ['HYPHA_USER_ID'] = '${server.config.user.id}'
print("Environment variables set successfully.")
    `, {
      onOutput: (output: any) => {
        if (output && output.type === 'stderr') {
          console.error("[Notebook] Error:", output.content);
        } else if (output && output.type === 'stdout') {
          console.log("[Notebook] Stdout:", output.content);
        } else {
          console.log("[Notebook] Output:", output);
        }
      },
      onStatus: (status: any) => {
        console.log("[Notebook] Status:", status);
      }
    });

    return api;
  } catch (error) {
    throw error;
  }
};

export type { HyphaCoreWindow, HyphaCoreService }; 