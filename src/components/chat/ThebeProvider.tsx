import React, { useEffect, useState, createContext, useContext } from 'react';

// Define types for JupyterLab services
interface KernelMessage {
  header: {
    msg_type: string;
  };
  content: any;
  msg_type?: string;
}

interface KernelConnection {
  requestExecute: (options: { code: string }) => {
    done: Promise<any>;
    onIOPub: ((msg: KernelMessage) => void) | ((callback: (msg: KernelMessage) => void) => void);
  };
  statusChanged: {
    connect: (callback: (sender: any, status: 'idle' | 'busy' | 'starting' | 'error') => void) => void;
  };
  status: 'idle' | 'busy' | 'starting' | 'error';
}

interface SessionConnection {
  kernel: KernelConnection | null;
}

interface ServiceManager {
  sessions: {
    startNew: (options: {
      path: string;
      type: string;
      name: string;
      kernel: { name: string };
    }) => Promise<SessionConnection>;
  };
}

interface OutputStore {
  [key: string]: {
    content: string;
    type: string;
    timestamp: number;
  }
}

interface ThebeContextType {
  serviceManager: ServiceManager | null;
  session: SessionConnection | null;
  kernel: KernelConnection | null;
  status: 'idle' | 'busy' | 'starting' | 'error';
  isReady: boolean;
  connect: () => Promise<KernelConnection>;
  executeCode: (code: string, callbacks?: {
    onOutput?: (output: { type: string; content: string; short_content?: string; attrs?: any }) => void;
    onStatus?: (status: string) => void;
  }) => Promise<void>;
  interruptKernel: () => Promise<void>;
  restartKernel: () => Promise<void>;
  kernelInfo: {
    pythonVersion?: string;
    pyodideVersion?: string;
  };
  outputStore: OutputStore;
  storeOutput: (content: string, type: string) => string; // returns the key
  getOutput: (key: string) => { content: string; type: string } | null;
}

const ThebeContext = createContext<ThebeContextType>({
  serviceManager: null,
  session: null,
  kernel: null,
  status: 'idle',
  isReady: false,
  connect: async () => { throw new Error('Thebe is not loaded yet'); },
  executeCode: async () => {},
  interruptKernel: async () => { throw new Error('Thebe is not loaded yet'); },
  restartKernel: async () => { throw new Error('Thebe is not loaded yet'); },
  kernelInfo: {},
  outputStore: {},
  storeOutput: () => '',
  getOutput: () => null,
});

export const useThebe = () => useContext(ThebeContext);

interface ThebeProviderProps {
  children: React.ReactNode;
}

declare global {
  interface Window {
    _thebe_lite_: {
      startJupyterLiteServer: (config?: any) => Promise<ServiceManager>;
    };
    thebeLite?: {
      version: string;
      startJupyterLiteServer: (config?: any) => Promise<ServiceManager>;
    };
    setupThebeLite?: Promise<void>;
  }
}

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

export const ThebeProvider: React.FC<ThebeProviderProps> = ({ children }) => {
  const [serviceManager, setServiceManager] = useState<ServiceManager | null>(null);
  const [session, setSession] = useState<SessionConnection | null>(null);
  const [kernel, setKernel] = useState<KernelConnection | null>(null);
  const [status, setStatus] = useState<'idle' | 'busy' | 'starting' | 'error'>('starting');
  const [isReady, setIsReady] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [kernelInfo, setKernelInfo] = useState<{ pythonVersion?: string; pyodideVersion?: string }>({});
  const [outputStore, setOutputStore] = useState<OutputStore>({});

  // Load required scripts and initialize kernel
  useEffect(() => {
    const initializeKernel = async () => {
      try {
        setIsScriptLoading(true);
        // Load thebe-lite script
        await loadScript('/thebe/thebe-lite.min.js');
        // Wait for thebe-lite setup to complete
        if (window.setupThebeLite) {
          await window.setupThebeLite;
        }
        setIsScriptLoading(false);
        
        // Connect to kernel
        await connect();
      } catch (error) {
        console.error('Failed to initialize kernel:', error);
        setStatus('error');
      }
    };

    initializeKernel();
  }, []);

  const getKernelInfo = async (kernel: KernelConnection) => {
    if (!kernel) {
      console.warn('Kernel info not ready');
      return;
    }
    
    try {
      console.log('Installing packages...');
      // First install required packages
      const installFuture = kernel.requestExecute({
        code: `
import micropip
await micropip.install(['numpy', 'nbformat', 'pandas', 'matplotlib', 'plotly', 'hypha-rpc', 'pyodide-http'])
import pyodide_http
pyodide_http.patch_all()
`
      });
      await installFuture.done;

      // Then get version info
      const future = kernel.requestExecute({
        code: `
import sys
import pyodide
print(f"{sys.version.split()[0]}")
`
      });

      let versions = '';
      future.onIOPub = (msg: KernelMessage) => {
        console.log('Kernel message:', msg);
        if (msg.header.msg_type === 'stream' && msg.content.name === 'stdout') {
          versions = msg.content.text.trim();
        }
      };
      await future.done;

      const [pythonVersion, pyodideVersion] = versions.split('|||');
      setKernelInfo({
        pythonVersion,
        pyodideVersion
      });
    } catch (error) {
      console.error('Failed to get kernel info:', error);
    }
  };

  const connect = async () => {
    if (!window.thebeLite) {
      console.error('Thebe is not loaded yet');
      setStatus('error');
      setError(new Error('Thebe is not loaded yet'));
      throw new Error('Thebe is not loaded yet');
    }

    setStatus('starting');
    try {
      // Configure JupyterLite settings
      const jupyterLiteConfig = {
        litePluginSettings: {
          '@jupyterlite/server-extension:service-worker': {
            enabled: true,
            path: '/service-worker.js',
            workerUrl: '/worker.js'
          },
        }
      };

      // Start JupyterLite server with configuration
      const server = await window.thebeLite.startJupyterLiteServer({
        ...jupyterLiteConfig,
        baseUrl: '/',
        appUrl: '/',
        assetsUrl: '/thebe/',
        fullMathjaxUrl: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js',
      });

      setServiceManager(server);

      // Create a new session
      const session = await server.sessions.startNew({
        name: '',
        path: 'test.ipynb',
        type: 'notebook',
        kernel: { name: 'python' }
      });

      setSession(session);

      // Wait for kernel to be ready
      const kernel = session.kernel;
      if (!kernel) throw new Error('Kernel not found');

      setKernel(kernel);

      // Wait for kernel to be ready using a Promise
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Kernel startup timeout'));
        }, 1200000);

        kernel.statusChanged.connect((_: unknown, status: 'idle' | 'busy' | 'starting' | 'error') => {
          console.log('Kernel status changed:', status);
          setStatus(status);
          if (status === 'idle') {
            clearTimeout(timeout);
            setIsReady(true);
            resolve();
          } else if (status === 'error') {
            clearTimeout(timeout);
            reject(new Error('Kernel failed to start'));
          }
        });
      });
      // After kernel is ready, get kernel info
      await getKernelInfo(kernel);
      return kernel;
    } catch (error) {
      console.error('Error connecting to kernel:', error);
      setStatus('error');
      setError(error as Error);
      throw error;
    }
  };

  // Function to generate a unique key for the store
  const generateStoreKey = (type: string) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}_${timestamp}_${random}`;
  };

  // Function to store output and return the key
  const storeOutput = (content: string, type: string) => {
    const key = generateStoreKey(type);
    setOutputStore(prev => ({
      ...prev,
      [key]: {
        content,
        type,
        timestamp: Date.now()
      }
    }));
    return key;
  };

  // Function to get output from store
  const getOutput = (key: string) => {
    const output = outputStore[key];
    return output ? { content: output.content, type: output.type } : null;
  };

  // Function to create a short representation of output
  const createShortContent = (content: string, type: string): string => {
    const maxLength = 200; // Adjust this value as needed
    if (content.length <= maxLength) return content;
    
    switch (type) {
      case 'stdout':
      case 'stderr':
        return `${content.substring(0, maxLength)}... [Full output stored with key: ${storeOutput(content, type)}]`;
      case 'html':
        return `[HTML content stored with key: ${storeOutput(content, type)}]`;
      case 'img':
        return `[Image stored with key: ${storeOutput(content, type)}]`;
      case 'svg':
        return `[SVG content stored with key: ${storeOutput(content, type)}]`;
      case 'plotly':
        return `[Plotly visualization stored with key: ${storeOutput(content, type)}]`;
      default:
        return `${content.substring(0, maxLength)}... [Full content stored with key: ${storeOutput(content, type)}]`;
    }
  };

  // Update executeCode function to include short_content
  const executeCode = async (
    code: string,
    callbacks?: {
      onOutput?: (output: { type: string; content: string; short_content?: string; attrs?: any }) => void;
      onStatus?: (status: string) => void;
    }
  ): Promise<void> => {
    const { onOutput, onStatus } = callbacks || {};

    // Get a ready kernel
    const currentKernel = kernel && isReady ? kernel : await connect();

    onStatus?.('Executing code...');

    try {
      const future = currentKernel.requestExecute({ code });
      // Handle kernel messages
      future.onIOPub = (msg: KernelMessage) => {
        console.log('Kernel message:', msg);
        const msgType = msg.msg_type || msg.header.msg_type;

        switch (msgType) {
          case 'stream':
            const streamContent = msg.content.text;
            onOutput?.({
              type: msg.content.name || 'stdout',
              content: streamContent,
              short_content: createShortContent(streamContent, msg.content.name || 'stdout')
            });
            break;
          case 'display_data':
          case 'execute_result':
            // Handle rich display data
            const data = msg.content.data;
            if (data['text/html']) {
              const htmlContent = data['text/html'];
              onOutput?.({
                type: 'html',
                content: htmlContent,
                short_content: createShortContent(htmlContent, 'html')
              });
            } else if (data['image/png']) {
              const imgContent = `data:image/png;base64,${data['image/png']}`;
              onOutput?.({
                type: 'img',
                content: imgContent,
                short_content: createShortContent(imgContent, 'img')
              });
            } else if (data['image/jpeg']) {
              const jpegContent = `data:image/jpeg;base64,${data['image/jpeg']}`;
              onOutput?.({
                type: 'img',
                content: jpegContent,
                short_content: createShortContent(jpegContent, 'img')
              });
            } else if (data['image/svg+xml']) {
              const svgContent = data['image/svg+xml'];
              onOutput?.({
                type: 'svg',
                content: svgContent,
                short_content: createShortContent(svgContent, 'svg')
              });
            } else if (data['application/vnd.plotly.v1+json']) {
              const plotlyContent = JSON.stringify(data['application/vnd.plotly.v1+json']);
              onOutput?.({
                type: 'plotly',
                content: plotlyContent,
                short_content: createShortContent(plotlyContent, 'plotly')
              });
            } else if (data['text/plain']) {
              const plainContent = data['text/plain'];
              onOutput?.({
                type: 'stdout',
                content: plainContent,
                short_content: createShortContent(plainContent, 'stdout')
              });
            }
            break;
          case 'error':
            const errorText = msg.content.traceback.join('\n');
            onOutput?.({
              type: 'stderr',
              content: errorText,
              short_content: createShortContent(errorText, 'stderr')
            });
            onStatus?.('Error');
            break;
          case 'status':
            const state = msg.content.execution_state;
            if (state === 'busy') {
              onStatus?.('Running...');
            } else if (state === 'idle') {
              onStatus?.('Completed');
            }
            break;
        }
      };
      // Wait for execution to complete
      await future.done;
    } catch (error) {
      console.error('Error executing code:', error);
      onStatus?.('Error');
      throw error;
    }
  };

  const interruptKernel = async () => {
    if (!kernel) {
      throw new Error('No kernel available');
    }
    try {
      // Send interrupt signal to kernel
      await kernel.requestExecute({ code: '\x03' }).done;
      setStatus('idle');
    } catch (error) {
      console.error('Failed to interrupt kernel:', error);
      throw error;
    }
  };

  const restartKernel = async () => {
    try {
      setStatus('starting');
      // Disconnect current kernel
      if (kernel) {
        await kernel.requestExecute({ code: 'exit()' }).done;
      }
      // Create new kernel connection
      const newKernel = await connect();
      await getKernelInfo(newKernel);
      setStatus('idle');
    } catch (error) {
      console.error('Failed to restart kernel:', error);
      setStatus('error');
      throw error;
    }
  };

  return (
    <ThebeContext.Provider 
      value={{ 
        serviceManager, 
        session, 
        kernel, 
        status, 
        isReady,
        connect,
        executeCode,
        interruptKernel,
        restartKernel,
        kernelInfo,
        outputStore,
        storeOutput,
        getOutput
      }}
    >
      {children}
    </ThebeContext.Provider>
  );
}; 