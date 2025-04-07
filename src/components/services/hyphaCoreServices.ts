import { HyphaCore } from 'hypha-core';

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
}

interface SetupNotebookServiceProps {
  onAddWindow: (config: any) => void;
  server: any;
  executeCode: (code: string, options?: any) => Promise<any>;
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

// Setup notebook service
export const setupNotebookService = async ({ onAddWindow, server, executeCode }: SetupNotebookServiceProps) => {
  // Initialize or get the existing HyphaCore promise
  if (!window._hyphaCorePromise) {
    const instance = new HyphaCore();
    const api = instance.start();
    window._hyphaCorePromise = { instance, api };
  }

  // Register the event handler on the instance
  window._hyphaCorePromise.instance.on("add_window", onAddWindow);

  console.log("Setting up notebook service");
  try {
    // Await the API promise
    const api = await window._hyphaCorePromise.api;
    
    const service: HyphaCoreService = {
      "id": "hypha-core",
      "name": "Hypha Core",
      "description": "Hypha Core service",
      "config": {
        "require_context": false,
      }
    };

    // Add API methods to service
    for (const key of Object.keys(api)) {
      if ((service as any)[key] === undefined) {
        if (typeof api[key] === 'function') {
          (service as any)[key] = (...args: any[]) => {
            console.log(`Calling ${key} with args`, args);
            return api[key](...args);
          };
        } else {
          (service as any)[key] = api[key];
        }
      }
    }

    const svc = await server.registerService(service, { overwrite: true });
    console.log(`Notebook service registered with id ${svc.id}`);
    
    const token = await server.generateToken();
    await executeCode(`from hypha_rpc import connect_to_server
server = await connect_to_server(server_url="${server.config.public_base_url}", token="${token}")
api = await server.get_service("${svc.id}")
    `, {
      onOutput: (output: any) => {
        console.log(output);
      },
      onStatus: (status: any) => {
        console.log(status);
      }
    });

    return api;
  } catch (error) {
    console.error("Failed to register notebook service:", error);
    throw error;
  }
};

export type { HyphaCoreWindow, HyphaCoreService }; 