import OpenAI from 'openai';
import { JSONSchema } from 'openai/lib/jsonschema';

export interface ImageInfo {
  url: string;
  title?: string;
}

export interface VisionInspectionOptions {
  images: ImageInfo[];
  query: string;
  contextDescription: string;
  model?: string;
  maxTokens?: number;
  baseURL?: string;
  apiKey?: string;
  outputSchema?: JSONSchema;
}

/**
 * Inspects images using GPT-4 Vision model.
 * This function is designed to work in the browser environment.
 * 
 * @param options Configuration options for the vision inspection
 * @returns A promise that resolves to the model's response
 */
export async function inspectImages({
  images,
  query,
  contextDescription,
  model = "gpt-4o-mini",
  maxTokens = 1024,
  baseURL,
  apiKey,
  outputSchema
}: VisionInspectionOptions): Promise<string> {

  // Validate image URLs
  for (const image of images) {
    if (!image.url.startsWith('http://') && !image.url.startsWith('https://') && !image.url.startsWith('data:')) {
      throw new Error(`Invalid image URL format: ${image.url}. URL must start with http://, https://, or data:.`);
    }
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
    dangerouslyAllowBrowser: true
  });

  // Build the content array for the user message conditionally
  const userContentParts: (OpenAI.Chat.ChatCompletionContentPartText | OpenAI.Chat.ChatCompletionContentPartImage)[] = [];

  if (contextDescription && typeof contextDescription === 'string' && contextDescription.trim() !== '') {
    userContentParts.push({ type: "text" as const, text: contextDescription });
  }

  if (query && typeof query === 'string' && query.trim() !== '') {
    userContentParts.push({ type: "text" as const, text: query });
  }

  userContentParts.push(...images.map(image => ({
    type: "image_url" as const,
    image_url: {
      url: image.url,
    }
  })));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "You are a helpful AI assistant that helps users inspect the provided images visually based on the context, make insightful comments and answer questions about the provided images."
    },
    {
      role: "user",
      content: userContentParts
    }
  ];

  try {
    // Conditionally add response_format based on outputSchema
    const completionParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
    };

    if (outputSchema && typeof outputSchema === 'object' && Object.keys(outputSchema).length > 0) {
      // Set response format to json_object. Schema enforcement relies on prompt instructions.
      completionParams.response_format = { type: "json_schema", json_schema: { schema: outputSchema as Record<string, unknown>, name: "outputSchema", strict: true } };
    }

    const response = await openai.chat.completions.create(completionParams);
    // if outputSchema is provided, parse the response using JSON.parse
    if (outputSchema && typeof outputSchema === 'object' && Object.keys(outputSchema).length > 0) {
      return JSON.parse(response.choices[0].message.content || "{}");
    }
    return response.choices[0].message.content || "No response generated";
  } catch (error) {
    console.error("Error in vision inspection:", error);
    throw error;
  }
}

/**
 * Converts a File or Blob to a base64 data URL.
 * 
 * @param file The file or blob to convert
 * @returns A promise that resolves to the base64 data URL
 */
export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a base64 string to a data URL with the correct MIME type.
 * 
 * @param base64 The base64 string
 * @param mimeType The MIME type of the image
 * @returns The complete data URL
 */
export function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
} 