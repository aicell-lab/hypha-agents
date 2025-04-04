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

// Setup notebook service
export const setupNotebookService = async ({ onAddWindow, server, executeCode }: SetupNotebookServiceProps) => {
  const hyphaCore = new HyphaCore();
  hyphaCore.on("add_window", onAddWindow);

  const api: any = await hyphaCore.start();
  console.log("Setting up notebook service");
  try {
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
hypha_core = await server.get_service("${svc.id}")
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