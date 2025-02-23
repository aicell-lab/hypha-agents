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

interface ThebeContextType {
  serviceManager: ServiceManager | null;
  session: SessionConnection | null;
  kernel: KernelConnection | null;
  status: 'idle' | 'busy' | 'starting' | 'error';
  isReady: boolean;
  connect: () => Promise<KernelConnection>;
  executeCode: (code: string, callbacks?: {
    onOutput?: (output: { type: string; content: string; attrs?: any }) => void;
    onStatus?: (status: string) => void;
  }) => Promise<void>;
  interruptKernel: () => Promise<void>;
  restartKernel: () => Promise<void>;
  kernelInfo: {
    pythonVersion?: string;
    pyodideVersion?: string;
  };
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
  kernelInfo: {}
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
    if (!kernel || !isReady) return;
    
    try {
      const future = kernel.requestExecute({
        code: `
import sys
import pyodide
print(f"{sys.version.split()[0]}|||{pyodide.__version__}")
`
      });

      let versions = '';
      future.onIOPub = (msg: KernelMessage) => {
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
        }, 30000);

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

  // Add executeCode function
  const executeCode = async (
    code: string,
    callbacks?: {
      onOutput?: (output: { type: string; content: string; attrs?: any }) => void;
      onStatus?: (status: string) => void;
    }
  ): Promise<void> => {
    const { onOutput, onStatus } = callbacks || {};

    // Get a ready kernel
    const currentKernel = kernel && isReady ? kernel : await connect();

    onStatus?.('Executing code...');

    try {
      // First install required packages if they are imported
      if (code.includes('import plotly')) {
        onOutput?.({
          type: 'stdout',
          content: 'Installing plotly package...\n'
        });
        await currentKernel.requestExecute({ 
          code: '%pip install plotly'
        }).done;
      }

      const future = currentKernel.requestExecute({ code });
      // Handle kernel messages
      future.onIOPub = (msg: KernelMessage) => {
        console.log('Kernel message:', msg);
        const msgType = msg.msg_type || msg.header.msg_type;

        switch (msgType) {
          case 'stream':
            onOutput?.({
              type: msg.content.name || 'stdout',
              content: msg.content.text
            });
            break;
          case 'display_data':
          case 'execute_result':
            // Handle rich display data
            const data = msg.content.data;
            if (data['text/html']) {
              onOutput?.({
                type: 'html',
                content: data['text/html']
              });
            } else if (data['image/png']) {
              onOutput?.({
                type: 'img',
                content: `data:image/png;base64,${data['image/png']}`
              });
            } else if (data['image/jpeg']) {
              onOutput?.({
                type: 'img',
                content: `data:image/jpeg;base64,${data['image/jpeg']}`
              });
            } else if (data['image/svg+xml']) {
              onOutput?.({
                type: 'svg',
                content: data['image/svg+xml']
              });
            } else if (data['application/vnd.plotly.v1+json']) {
              onOutput?.({
                type: 'plotly',
                content: JSON.stringify(data['application/vnd.plotly.v1+json'])
              });
            } else if (data['text/plain']) {
              onOutput?.({
                type: 'stdout',
                content: data['text/plain']
              });
            }
            break;
          case 'error':
            const errorText = msg.content.traceback.join('\n');
            onOutput?.({
              type: 'stderr',
              content: errorText
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
      // Get kernel info after restart
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
        kernelInfo
      }}
    >
      {children}
    </ThebeContext.Provider>
  );
}; 