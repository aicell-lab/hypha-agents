import { useState, useCallback, useMemo, useEffect } from 'react';
import type { MountedDirectory, EnvironmentVariable, HyphaService } from '../components/notebook/EnvironmentInfoDialog';
import type { NotebookMetadata } from '../types/notebook';
import * as hyphaWebsocketClient from 'hypha-rpc';

export interface UseEnvironmentStateReturn {
  // State
  mountedDirectories: MountedDirectory[];
  environmentVariables: EnvironmentVariable[];
  installedServices: HyphaService[];

  // Actions
  addMountedDirectory: (name: string, mountPoint: string) => void;
  addEnvironmentVariable: (key: string, value: string) => Promise<void>;
  removeEnvironmentVariable: (key: string) => Promise<void>;
  addInstalledService: (serviceUrl: string) => Promise<void>;
  removeInstalledService: (serviceId: string) => void;
  initializeKernelEnvironment: () => Promise<void>; // Initialize env vars in kernel

  // Generated prompt
  environmentPrompt: string;
}

interface UseEnvironmentStateProps {
  server?: any; // Hypha server instance for fetching service info
  notebookMetadata?: NotebookMetadata; // Notebook metadata to load/save env vars
  onMetadataChange?: (metadata: NotebookMetadata) => void; // Callback to update notebook metadata
  executeCode?: (code: string) => Promise<any>; // Function to execute Python code in the kernel
  serverUrl?: string; // Current server URL (e.g., 'https://hypha.aicell.io')
  userToken?: string; // User authentication token for connecting to other servers
}

export function useEnvironmentState({
  server,
  notebookMetadata,
  onMetadataChange,
  executeCode,
  serverUrl,
  userToken
}: UseEnvironmentStateProps): UseEnvironmentStateReturn {
  const [mountedDirectories, setMountedDirectories] = useState<MountedDirectory[]>([]);
  const [environmentVariables, setEnvironmentVariables] = useState<EnvironmentVariable[]>([]);
  const [installedServices, setInstalledServices] = useState<HyphaService[]>([]);

  // Initialize environment variables from notebook metadata
  useEffect(() => {
    if (notebookMetadata?.environmentVariables) {
      setEnvironmentVariables(notebookMetadata.environmentVariables);
    }
  }, [notebookMetadata?.environmentVariables]);

  // Initialize installed services from notebook metadata
  useEffect(() => {
    const loadServicesFromMetadata = async () => {
      if (!notebookMetadata?.installedServices || notebookMetadata.installedServices.length === 0) {
        // Clear services if metadata has none
        if (installedServices.length > 0) {
          setInstalledServices([]);
        }
        return;
      }

      if (!server) {
        console.warn('[EnvironmentState] Cannot load services: server not connected');
        return;
      }

      // Check if we need to reload - compare URLs in metadata with currently loaded services
      const metadataUrls = notebookMetadata.installedServices.map(s => s.serviceUrl).sort();
      const loadedUrls = installedServices.map(s => s.serviceUrl).sort();

      if (JSON.stringify(metadataUrls) === JSON.stringify(loadedUrls)) {
        // Services are already loaded, no need to reload
        return;
      }

      console.log('[EnvironmentState] Loading services from metadata:', notebookMetadata.installedServices);

      // Fetch schema for each service URL
      const loadedServices: HyphaService[] = [];
      for (const { serviceUrl } of notebookMetadata.installedServices) {
        try {
          console.log('[EnvironmentState] Fetching service from metadata:', serviceUrl);

          // Use the same logic as addInstalledService but without saving to metadata
          let targetServer = server;
          let serviceQuery = serviceUrl;

          // Parse URL if it's a full URL
          if (serviceUrl.startsWith('http://') || serviceUrl.startsWith('https://')) {
            const url = new URL(serviceUrl);
            const targetServerUrl = `${url.protocol}//${url.host}`;
            const pathParts = url.pathname.split('/').filter(p => p);

            if (pathParts.length >= 2) {
              const workspace = pathParts[0];
              const servicePartIndex = pathParts.findIndex(p => p.includes(':'));

              if (servicePartIndex !== -1) {
                const servicePart = pathParts[servicePartIndex];
                const [clientId, serviceId] = servicePart.split(':');

                if (clientId && serviceId) {
                  serviceQuery = `${workspace}/${clientId}:${serviceId}`;
                }
              }
            }

            // Connect to different server if needed
            if (serverUrl && targetServerUrl !== serverUrl) {
              if (userToken) {
                targetServer = await hyphaWebsocketClient.connectToServer({
                  server_url: targetServerUrl,
                  token: userToken,
                  method_timeout: 180000
                });
              } else {
                console.warn(`[EnvironmentState] Cannot connect to ${targetServerUrl}: no token available`);
                continue;
              }
            }
          }

          // Fetch the service
          const service = await targetServer.getService(serviceQuery);
          if (!service) {
            console.warn(`[EnvironmentState] Service not found: ${serviceQuery}`);
            continue;
          }

          // Get service schema via HTTP GET request
          let schema: any = null;
          let functions: HyphaService['functions'] = [];

          try {
            console.log('[EnvironmentState] Fetching service schema via HTTP GET (from metadata):', serviceUrl);
            const response = await fetch(serviceUrl);

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const serviceData = await response.json();

            if (serviceData.service_schema) {
              schema = serviceData.service_schema;
              console.log('[EnvironmentState] Got service_schema from HTTP response (from metadata)');

              if (typeof schema === 'object') {
                const toolDefinitions = Array.isArray(schema) ? schema : Object.values(schema);
                functions = toolDefinitions.map((tool: any) => {
                  if (tool.function) {
                    return {
                      name: tool.function.name || 'unknown',
                      description: tool.function.description || '',
                      parameters: tool.function.parameters || {}
                    };
                  }
                  return null;
                }).filter(Boolean) as HyphaService['functions'];
              }
            } else {
              console.warn('[EnvironmentState] No service_schema found in HTTP response (from metadata)');
            }
          } catch (error) {
            console.error('[EnvironmentState] Error fetching service schema via HTTP (from metadata):', error);
          }

          const displayServiceId = serviceQuery.includes(':')
            ? serviceQuery.split(':').pop() || serviceQuery
            : serviceQuery.split('/').pop() || serviceQuery;

          const serviceName = service.name || service.id || displayServiceId;
          const serviceDescription = service.description || 'Hypha service';

          loadedServices.push({
            id: displayServiceId,
            name: serviceName,
            description: serviceDescription,
            serviceUrl: serviceUrl,
            functions: functions,
            schema: schema
          });

          console.log('[EnvironmentState] Loaded service:', serviceName);
        } catch (error) {
          console.error(`[EnvironmentState] Error loading service ${serviceUrl}:`, error);
        }
      }

      if (loadedServices.length > 0) {
        setInstalledServices(loadedServices);
        console.log(`[EnvironmentState] Loaded ${loadedServices.length} services from metadata`);
      }
    };

    loadServicesFromMetadata();
  }, [notebookMetadata?.installedServices, server, serverUrl, userToken, installedServices]);

  // Helper function to update environment variables in the kernel
  const updateKernelEnvironment = useCallback(async (vars: EnvironmentVariable[]) => {
    if (!executeCode) return;

    try {
      // Generate Python code to set all environment variables
      const envVarCode = vars.map(v => {
        // Escape single quotes in the value
        const escapedValue = v.value.replace(/'/g, "\\'");
        return `os.environ['${v.key}'] = '${escapedValue}'`;
      }).join('\n');

      const code = `import os\n${envVarCode}`;

      console.log('[EnvironmentState] Updating kernel environment variables');
      await executeCode(code);
    } catch (error) {
      console.error('[EnvironmentState] Error updating kernel environment:', error);
    }
  }, [executeCode]);

  // Add a mounted directory
  const addMountedDirectory = useCallback((name: string, mountPoint: string) => {
    const newDir: MountedDirectory = {
      name,
      mountPoint,
      timestamp: new Date().toISOString(),
    };
    setMountedDirectories(prev => {
      // Check if already exists
      if (prev.some(d => d.mountPoint === mountPoint)) {
        return prev;
      }
      return [...prev, newDir];
    });
  }, []);

  // Add an environment variable
  const addEnvironmentVariable = useCallback(async (key: string, value: string) => {
    const updatedVars = environmentVariables.some(v => v.key === key)
      ? environmentVariables.map(v => v.key === key ? { key, value } : v)
      : [...environmentVariables, { key, value }];

    setEnvironmentVariables(updatedVars);

    // Update notebook metadata
    if (onMetadataChange && notebookMetadata) {
      onMetadataChange({
        ...notebookMetadata,
        environmentVariables: updatedVars
      });
    }

    // Update the kernel environment
    await updateKernelEnvironment(updatedVars);
  }, [environmentVariables, notebookMetadata, onMetadataChange, updateKernelEnvironment]);

  // Remove an environment variable
  const removeEnvironmentVariable = useCallback(async (key: string) => {
    const updatedVars = environmentVariables.filter(v => v.key !== key);
    setEnvironmentVariables(updatedVars);

    // Update notebook metadata
    if (onMetadataChange && notebookMetadata) {
      onMetadataChange({
        ...notebookMetadata,
        environmentVariables: updatedVars
      });
    }

    // Update the kernel environment (set all remaining vars)
    await updateKernelEnvironment(updatedVars);

    // Also unset the removed variable in the kernel
    if (executeCode) {
      try {
        await executeCode(`import os\nif '${key}' in os.environ:\n    del os.environ['${key}']`);
      } catch (error) {
        console.error('[EnvironmentState] Error removing env var from kernel:', error);
      }
    }
  }, [environmentVariables, notebookMetadata, onMetadataChange, updateKernelEnvironment, executeCode]);

  // Add a Hypha service by fetching its info
  const addInstalledService = useCallback(async (serviceUrl: string) => {
    if (!server) {
      throw new Error('Server not connected. Please ensure you are connected to a Hypha server.');
    }

    try {
      console.log('[EnvironmentState] Fetching service:', serviceUrl);

      // Parse the service URL
      // Format: https://hypha.aicell.io/bioimage-io/services/bioengine-worker-659c8c4445-sgmvn:bioengine-worker
      // Extract: serverUrl, workspace, clientId, serviceId
      let targetServer = server;
      let serviceQuery = serviceUrl;

      // Check if it's a full URL
      if (serviceUrl.startsWith('http://') || serviceUrl.startsWith('https://')) {
        const url = new URL(serviceUrl);
        const targetServerUrl = `${url.protocol}//${url.host}`;
        const pathParts = url.pathname.split('/').filter(p => p);

        // Expected format: /workspace/services/clientId:serviceId
        // or: /workspace/clientId:serviceId
        if (pathParts.length < 2) {
          throw new Error('Invalid service URL format. Expected: https://server/workspace/[services/]clientId:serviceId');
        }

        const workspace = pathParts[0];
        // Find the part with the colon (clientId:serviceId)
        const servicePartIndex = pathParts.findIndex(p => p.includes(':'));
        if (servicePartIndex === -1) {
          throw new Error('Invalid service URL format. Service ID must be in format clientId:serviceId');
        }

        const servicePart = pathParts[servicePartIndex]; // e.g., "bioengine-worker-659c8c4445-sgmvn:bioengine-worker"
        const [clientId, serviceId] = servicePart.split(':');

        if (!clientId || !serviceId) {
          throw new Error('Invalid service format. Expected format: clientId:serviceId');
        }

        // Construct the service query: workspace/clientId:serviceId
        serviceQuery = `${workspace}/${clientId}:${serviceId}`;

        console.log('[EnvironmentState] Parsed service URL:', {
          targetServerUrl,
          workspace,
          clientId,
          serviceId,
          serviceQuery
        });

        // Check if we need to connect to a different server
        if (serverUrl && targetServerUrl !== serverUrl) {
          console.log('[EnvironmentState] Connecting to different server:', targetServerUrl);

          if (!userToken) {
            throw new Error(`Cannot connect to ${targetServerUrl}: User token not available. Please log in first.`);
          }

          // Connect to the target server
          targetServer = await hyphaWebsocketClient.connectToServer({
            server_url: targetServerUrl,
            token: userToken,
            method_timeout: 180000
          });

          console.log('[EnvironmentState] Successfully connected to:', targetServerUrl);
        }
      }

      // Fetch the actual service from Hypha server
      console.log('[EnvironmentState] Fetching service with query:', serviceQuery);
      const service = await targetServer.getService(serviceQuery);

      if (!service) {
        throw new Error(`Service not found: ${serviceQuery}`);
      }

      // Get the service schema and metadata via HTTP GET request
      let schema: any = null;
      let functions: HyphaService['functions'] = [];
      let serviceName = '';
      let serviceDescription = '';

      // Extract service ID from the query (for display purposes)
      const displayServiceId = serviceQuery.includes(':')
        ? serviceQuery.split(':').pop() || serviceQuery
        : serviceQuery.split('/').pop() || serviceQuery;

      try {
        console.log('[EnvironmentState] Fetching service info via HTTP GET:', serviceUrl);
        const response = await fetch(serviceUrl);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const serviceData = await response.json();

        // Get name and description
        serviceName = serviceData.name || service.name || service.id || displayServiceId;
        serviceDescription = serviceData.description || service.description || 'Hypha service';

        // Get schema
        if (serviceData.service_schema) {
          schema = serviceData.service_schema;
          console.log('[EnvironmentState] Got service_schema from HTTP response');
          console.log('[EnvironmentState] Service schema has', Object.keys(schema).length, 'functions');

          // Extract function information from schema
          if (typeof schema === 'object') {
            // Schema can be an array of tool definitions or an object with tool definitions
            const toolDefinitions = Array.isArray(schema) ? schema : Object.values(schema);

            functions = toolDefinitions.map((tool: any) => {
              if (tool.function) {
                return {
                  name: tool.function.name || 'unknown',
                  description: tool.function.description || '',
                  parameters: tool.function.parameters || {}
                };
              }
              return null;
            }).filter(Boolean) as HyphaService['functions'];
          }
        } else {
          console.warn('[EnvironmentState] No service_schema found in HTTP response');
        }
      } catch (error) {
        console.error('[EnvironmentState] Error fetching service info via HTTP:', error);
        // Fallback to service object
        serviceName = service.name || service.id || displayServiceId;
        serviceDescription = service.description || 'Hypha service';
      }

      const newService: HyphaService = {
        id: displayServiceId,
        name: serviceName,
        description: serviceDescription,
        serviceUrl: serviceUrl, // Store the original URL
        functions: functions,
        schema: schema // Store the full schema for generating prompts
      };

      setInstalledServices(prev => {
        // Check if already exists
        if (prev.some(s => s.serviceUrl === serviceUrl)) {
          console.warn('[EnvironmentState] Service already installed:', serviceUrl);
          throw new Error(`Service "${serviceName}" is already installed`);
        }
        return [...prev, newService];
      });

      // Update notebook metadata to persist the service URL (not the schema)
      if (onMetadataChange && notebookMetadata) {
        const currentServices = notebookMetadata.installedServices || [];
        const updatedServices = [...currentServices, { serviceUrl }];

        onMetadataChange({
          ...notebookMetadata,
          installedServices: updatedServices
        });
      }

      console.log('[EnvironmentState] Successfully added service:', newService);
    } catch (error) {
      console.error('[EnvironmentState] Error adding service:', error);
      throw error;
    }
  }, [server, serverUrl, userToken, notebookMetadata, onMetadataChange]);

  // Remove a Hypha service
  const removeInstalledService = useCallback((serviceId: string) => {
    // Find the service to remove to get its URL
    const serviceToRemove = installedServices.find(s => s.id === serviceId);

    if (!serviceToRemove) {
      console.warn('[EnvironmentState] Service not found:', serviceId);
      return;
    }

    // Remove from state
    setInstalledServices(prev => prev.filter(s => s.id !== serviceId));

    // Update notebook metadata to remove the service URL
    if (onMetadataChange && notebookMetadata) {
      const currentServices = notebookMetadata.installedServices || [];
      const updatedServices = currentServices.filter(s => s.serviceUrl !== serviceToRemove.serviceUrl);

      onMetadataChange({
        ...notebookMetadata,
        installedServices: updatedServices
      });
    }

    console.log('[EnvironmentState] Removed service:', serviceId);
  }, [installedServices, notebookMetadata, onMetadataChange]);

  // Generate the environment prompt
  const environmentPrompt = useMemo(() => {
    let prompt = '';

    // Mounted directories section
    if (mountedDirectories.length > 0) {
      prompt += '### Mounted Local Directories\n\n';
      prompt += 'The following local directories have been mounted and are accessible:\n\n';
      mountedDirectories.forEach(dir => {
        prompt += `- **\`${dir.name}\`** at \`${dir.mountPoint}\`\n`;
      });
      prompt += '\n';
    }

    // Environment variables section
    if (environmentVariables.length > 0) {
      prompt += '### Environment Variables\n\n';
      prompt += 'The following environment variables are configured:\n\n';
      environmentVariables.forEach(env => {
        prompt += `- **${env.key}**: \`${env.value}\`\n`;
      });
      prompt += '\nAccess using: `os.environ.get(\'VARIABLE_NAME\')`\n\n';
    }

    // Installed services section
    if (installedServices.length > 0) {
      prompt += '### Available Hypha Services\n\n';
      prompt += '**Important**: You have access to external Hypha services that provide additional capabilities.\n\n';

      // Add general instructions for using Hypha services
      prompt += '#### How to Use Hypha Services\n\n';
      prompt += 'To use a Hypha service, you need to:\n';
      prompt += '1. Get the service from the server using `await server.get_service(\'service_id\')`\n';
      prompt += '2. Call the service functions using `await service.function_name(...)`\n\n';
      prompt += '**Example**:\n';
      prompt += '```python\n';
      prompt += '# Step 1: Get the service\n';
      prompt += 'my_service = await server.get_service(\'workspace/client-id:service-id\')\n\n';
      prompt += '# Step 2: Call service functions\n';
      prompt += 'result = await my_service.some_function(param1="value", param2=123)\n';
      prompt += 'print(result)\n';
      prompt += '```\n\n';

      // List each service with its tools
      installedServices.forEach((service, index) => {
        prompt += `#### Service ${index + 1}: ${service.name}\n\n`;
        if (service.description) {
          prompt += `**Description**: ${service.description}\n\n`;
        }

        // Parse service URL to get the service ID for get_service call
        let serviceId = service.serviceUrl;
        if (service.serviceUrl.startsWith('http://') || service.serviceUrl.startsWith('https://')) {
          try {
            const url = new URL(service.serviceUrl);
            const pathParts = url.pathname.split('/').filter(p => p);
            const workspace = pathParts[0];
            const servicePart = pathParts.find(p => p.includes(':'));
            if (workspace && servicePart) {
              serviceId = `${workspace}/${servicePart}`;
            }
          } catch (e) {
            // Keep original serviceUrl if parsing fails
          }
        }

        prompt += `**Service ID**: \`${serviceId}\`\n\n`;
        prompt += '**How to get this service**:\n';
        prompt += '```python\n';
        prompt += `${service.id.replace(/-/g, '_')} = await server.get_service("${serviceId}")\n`;
        prompt += '```\n\n';

        // Show the complete service_schema
        if (service.schema) {
          // Convert array schema back to object format for display (if it's an array)
          let schemaToDisplay = service.schema;
          if (Array.isArray(service.schema)) {
            // Convert array to object with function names as keys
            schemaToDisplay = {};
            service.schema.forEach((tool: any) => {
              if (tool.function?.name) {
                schemaToDisplay[tool.function.name] = tool;
              }
            });
          }

          const functionCount = service.functions?.length || Object.keys(schemaToDisplay).length;
          prompt += `**Service Schema** (${functionCount} functions):\n\n`;
          prompt += 'The following tools are available in this service with their complete argument schemas:\n\n';
          prompt += '```json\n';
          prompt += JSON.stringify(schemaToDisplay, null, 2);
          prompt += '\n```\n\n';

          // Show usage examples
          prompt += '**Usage Examples**:\n\n';
          const serviceName = service.id.replace(/-/g, '_');

          if (service.functions && service.functions.length > 0) {
            // Show examples for first 2-3 functions
            const exampleFunctions = service.functions.slice(0, Math.min(3, service.functions.length));

            exampleFunctions.forEach((func, idx) => {
              prompt += `${idx + 1}. **${func.name}**`;
              if (func.description) {
                const shortDesc = func.description.length > 80
                  ? func.description.substring(0, 77) + '...'
                  : func.description;
                prompt += ` - ${shortDesc}`;
              }
              prompt += '\n';

              prompt += '   ```python\n';
              prompt += `   result = await ${serviceName}.${func.name}(`;

              if (func.parameters && func.parameters.properties) {
                const params = Object.entries(func.parameters.properties);
                const requiredParams = func.parameters.required || [];
                const paramExamples = params.slice(0, 2).map(([name, info]: [string, any]) => {
                  const example = info.type === 'string' ? `"example"` :
                                 info.type === 'number' ? `42` :
                                 info.type === 'boolean' ? `True` :
                                 info.type === 'array' ? `[]` :
                                 info.type === 'object' ? `{}` : `None`;
                  return `${name}=${example}`;
                });
                prompt += paramExamples.join(', ');
              }

              prompt += ')\n';
              prompt += '   print(result)\n';
              prompt += '   ```\n\n';
            });

            // Add a complete workflow example
            prompt += '**Complete Workflow Example**:\n';
            prompt += '```python\n';
            prompt += `# Step 1: Get the service\n`;
            prompt += `${serviceName} = await server.get_service("${serviceId}")\n\n`;
            prompt += `# Step 2: Use the service functions\n`;

            const firstFunc = service.functions[0];
            if (firstFunc.parameters && firstFunc.parameters.properties) {
              const params = Object.entries(firstFunc.parameters.properties);
              const paramExamples = params.slice(0, 2).map(([name, info]: [string, any]) => {
                const example = info.type === 'string' ? `"example"` :
                               info.type === 'number' ? `42` :
                               info.type === 'boolean' ? `True` : `None`;
                return `${name}=${example}`;
              });
              prompt += `result = await ${serviceName}.${firstFunc.name}(${paramExamples.join(', ')})\n`;
            } else {
              prompt += `result = await ${serviceName}.${firstFunc.name}()\n`;
            }
            prompt += 'print(result)\n';
            prompt += '```\n\n';
          }
        } else if (service.functions && service.functions.length > 0) {
          // Fallback if no schema but we have function info
          prompt += `**Available Functions** (${service.functions.length}):\n`;
          service.functions.forEach(func => {
            prompt += `- **\`${func.name}\`**`;
            if (func.description) {
              prompt += `: ${func.description}`;
            }
            prompt += '\n';
          });
          prompt += '\n';
        }

        prompt += '---\n\n';
      });
    }

    return prompt;
  }, [mountedDirectories, environmentVariables, installedServices]);

  // Initialize environment variables in the kernel
  const initializeKernelEnvironment = useCallback(async () => {
    if (environmentVariables.length > 0) {
      console.log('[EnvironmentState] Initializing kernel environment variables');
      await updateKernelEnvironment(environmentVariables);
    }
  }, [environmentVariables, updateKernelEnvironment]);

  return {
    mountedDirectories,
    environmentVariables,
    installedServices,
    addMountedDirectory,
    addEnvironmentVariable,
    removeEnvironmentVariable,
    addInstalledService,
    removeInstalledService,
    initializeKernelEnvironment,
    environmentPrompt,
  };
}
