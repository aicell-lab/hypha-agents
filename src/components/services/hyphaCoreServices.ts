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
  projectId: string;
}

// Store the HyphaCore instance and API promise globally
declare global {
  interface Window {
    _hyphaCoreInstance?: HyphaCore;
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

/**
 * Initialize HyphaCore with services
 * This should be called early in AgentLab before kernel initialization
 */
export const initializeHyphaCore = async ({
  onAddWindow,
  agentSettings,
}: {
  onAddWindow: (config: any) => void;
  agentSettings: AgentSettings;
}): Promise<any> => {
  // Check if already initialized
  if (window._hyphaCoreInstance) {
    return window._hyphaCoreInstance;
  }

  // Create HyphaCore instance with defaultService
  const hyphaCore = new HyphaCore({
    defaultService: {
      // Vision inspection service
      inspectImages: async (options: {
        images: ImageInfo[];
        query: string;
        contextDescription: string;
        outputSchema?: JSONSchema;
      }): Promise<string | any> => {
        if (!isVisionModel(agentSettings.model)) {
          return `Error: Model '${agentSettings.model}' does not support vision capabilities. Please use a vision-capable model like gpt-4o, gpt-4-vision, or llava.`;
        }

        try {
          return await inspectImages({
            ...options,
            model: agentSettings.model,
            baseURL: agentSettings.baseURL,
            apiKey: agentSettings.apiKey,
            outputSchema: options.outputSchema,
          });
        } catch (error) {
          console.error("Error in inspectImages:", error);
          throw error;
        }
      },

      // Chat completion service
      chatCompletion: async (options: {
        messages: ChatMessage[];
        max_tokens?: number;
        response_format?:
          | { type: "text" }
          | { type: "json_object" }
          | { type: "json_schema"; json_schema: JsonSchemaDetails };
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
          stream: false,
        };

        // Conditionally add the response_format based on the refined type
        if (response_format) {
          if (response_format.type === 'json_schema') {
            completionParams.response_format = {
              type: 'json_schema',
              json_schema: response_format.json_schema
            };
          } else {
            completionParams.response_format = { type: response_format.type };
          }
        }

        try {
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
      }
    }
  });

  // Store globally
  window._hyphaCoreInstance = hyphaCore;

  // Register event handler
  hyphaCore.on("add_window", onAddWindow);

  // Start HyphaCore and store the API promise
  const apiPromise = hyphaCore.start();
  window._hyphaCorePromise = {
    instance: hyphaCore,
    api: apiPromise
  };

  // Wait for API to be ready
  return await apiPromise;
};

// Setup notebook service (kernel initialization only)
export const setupNotebookService = async ({
  onAddWindow,
  server,
  executeCode,
  projectId,
}: SetupNotebookServiceProps) => {
  // Get the existing HyphaCore instance (should be initialized by AgentLab)
  if (!window._hyphaCoreInstance) {
    throw new Error('HyphaCore instance not found. It should be initialized before setupNotebookService is called.');
  }

  const instance = window._hyphaCoreInstance;

  // Get the API (should already be started)
  const api = await (window._hyphaCorePromise?.api || instance.start());

  try {

    // Setup kernel with additional packages
    const token = server ? await server.generateToken() : '';
    await executeCode(`import micropip
await micropip.install(['numpy', 'nbformat', 'pandas', 'matplotlib', 'plotly', 'pyodide-http'])
import pyodide_http
pyodide_http.patch_all()
%matplotlib inline

# Set environment variables
import os
os.environ['CURRENT_URL'] = '${window.location.href}'
os.environ['HYPHA_SERVER_URL'] = '${server?.config?.public_base_url || ''}'
os.environ['HYPHA_WORKSPACE'] = '${server?.config?.workspace || ''}'
os.environ['HYPHA_TOKEN'] = '${token}'
os.environ['HYPHA_PROJECT_ID'] = '${projectId}'
os.environ['HYPHA_USER_ID'] = '${server?.config?.user?.id || ''}'
    `);

    return api;
  } catch (error) {
    throw error;
  }
};

export type { HyphaCoreWindow, HyphaCoreService }; 