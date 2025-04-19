import React, { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react';
import getSetupCode from './StartupCode';
import { executeScripts } from '../../utils/script-utils';
import { processTextOutput, processAnsiInOutputElement } from '../../utils/ansi-utils';
import { useHyphaStore } from '../../store/hyphaStore';

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
  restart(): Promise<void>;
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

interface KernelError {
  type?: string;
  message?: string;
}

// Define type for log entries
interface KernelExecutionLogEntry {
  timestamp: number;
  type: 'input' | 'output' | 'error' | 'status';
  content: string;
  cellId?: string; // Optional: Track which cell initiated the execution
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
    cellId?: string; // Accept cellId
  }, timeout?: number) => Promise<void>;
  executeCodeWithDOMOutput: (code: string, outputElement: HTMLElement, callbacks?: {
    onOutput?: (output: { type: string; content: string; short_content?: string; attrs?: any }) => void;
    onStatus?: (status: string) => void;
    cellId?: string; // Accept cellId
  }) => Promise<void>;
  interruptKernel: () => Promise<void>;
  restartKernel: () => Promise<void>;
  resetKernelState: () => Promise<void>;
  kernelInfo: {
    pythonVersion?: string;
    pyodideVersion?: string;
  };
  outputStore: OutputStore;
  storeOutput: (content: string, type: string) => string; // returns the key
  getOutput: (key: string) => { content: string; type: string } | null;
  kernelExecutionLog: KernelExecutionLogEntry[];
  addKernelLogEntry: (entry: Omit<KernelExecutionLogEntry, 'timestamp'>) => void;
}

const ThebeContext = createContext<ThebeContextType>({
  serviceManager: null,
  session: null,
  kernel: null,
  status: 'idle',
  isReady: false,
  connect: async () => { throw new Error('Thebe is not loaded yet'); },
  executeCode: async () => {},
  executeCodeWithDOMOutput: async () => {},
  interruptKernel: async () => { throw new Error('Thebe is not loaded yet'); },
  restartKernel: async () => { throw new Error('Thebe is not loaded yet'); },
  resetKernelState: async () => { throw new Error('Thebe is not loaded yet'); },
  kernelInfo: {},
  outputStore: {},
  storeOutput: () => '',
  getOutput: () => null,
  kernelExecutionLog: [],
  addKernelLogEntry: () => {},
});

export const useThebe = () => useContext(ThebeContext);

interface ThebeProviderProps {
  children: React.ReactNode;
  lazy?: boolean;
}

// Global singleton to track kernel instance
interface GlobalThebeState {
  isInitialized: boolean;
  isInitializing: boolean;
  serviceManager: ServiceManager | null;
  session: SessionConnection | null;
  kernel: KernelConnection | null;
  status: 'idle' | 'busy' | 'starting' | 'error';
  isReady: boolean;
  kernelInfo: {
    pythonVersion?: string;
    pyodideVersion?: string;
  };
  outputStore: OutputStore;
  referenceCount: number;
  initPromise: Promise<KernelConnection> | null;
  kernelExecutionLog: KernelExecutionLogEntry[];
}

// Create a global singleton to manage the kernel instance
const globalThebeState: GlobalThebeState = {
  isInitialized: false,
  isInitializing: false,
  serviceManager: null,
  session: null,
  kernel: null,
  status: 'idle',
  isReady: false,
  kernelInfo: {},
  outputStore: {},
  referenceCount: 0,
  initPromise: null,
  kernelExecutionLog: [],
};

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
    globalThebeState?: GlobalThebeState; // Expose for debugging
    jupyterDisplayData?: {
      [key: string]: (data: any) => void;
    };
  }
}

// Expose the global state for debugging
if (typeof window !== 'undefined') {
  window.globalThebeState = globalThebeState;
}

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

// LazyThebeProvider only initializes when visible
export const LazyThebeProvider: React.FC<ThebeProviderProps> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Set up intersection observer to detect visibility
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 } // 10% visibility is enough to trigger
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {isVisible ? (
        <ThebeProvider>{children}</ThebeProvider>
      ) : (
        <div className="w-full h-full">{children}</div>
      )}
    </div>
  );
};

export const ThebeProvider: React.FC<ThebeProviderProps> = ({ children, lazy = false }) => {
  const [serviceManager, setServiceManager] = useState<ServiceManager | null>(globalThebeState.serviceManager);
  const [session, setSession] = useState<SessionConnection | null>(globalThebeState.session);
  const [kernel, setKernel] = useState<KernelConnection | null>(globalThebeState.kernel);
  const [status, setStatus] = useState<'idle' | 'busy' | 'starting' | 'error'>(globalThebeState.status);
  const [isReady, setIsReady] = useState(globalThebeState.isReady);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [kernelInfo, setKernelInfo] = useState<{ pythonVersion?: string; pyodideVersion?: string }>(globalThebeState.kernelInfo);
  const [outputStore, setOutputStore] = useState<OutputStore>(globalThebeState.outputStore);
  const [kernelExecutionLog, setKernelExecutionLog] = useState<KernelExecutionLogEntry[]>(globalThebeState.kernelExecutionLog);
  const hasInitialized = useRef(false);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout>();
  const { server: hyphaServer } = useHyphaStore();

  // Load required scripts and initialize kernel
  useEffect(() => {
    // Increment reference count when component mounts
    globalThebeState.referenceCount++;
    console.log(`ThebeProvider mounted. Reference count: ${globalThebeState.referenceCount}`);

    let isMounted = true; // Track if component is mounted

    const initializeKernel = async () => {
      // If already initialized or initializing, don't do it again
      if (globalThebeState.isInitialized || globalThebeState.isInitializing) {
        console.log('Kernel already initialized or initializing, reusing existing instance');
        
        // If initializing, wait for it to complete
        if (globalThebeState.isInitializing && globalThebeState.initPromise) {
          try {
            await globalThebeState.initPromise;
            // Only update state if component is still mounted
            if (isMounted) {
              setServiceManager(globalThebeState.serviceManager);
              setSession(globalThebeState.session);
              setKernel(globalThebeState.kernel);
              setStatus(globalThebeState.status);
              setIsReady(globalThebeState.isReady);
              setKernelInfo(globalThebeState.kernelInfo);
            }
          } catch (error) {
            const kernelError = error as KernelError;
            if (kernelError?.type === 'cancelation') {
              console.log('Kernel initialization was canceled');
              return;
            }
            console.error('Error waiting for kernel initialization:', error);
          }
        }
        
        // If kernel is already initialized and ready, reset its state
        if (globalThebeState.isInitialized && globalThebeState.isReady && globalThebeState.kernel) {
          console.log('Resetting kernel state for reused kernel instance...');
          try {
            // Only update state if component is still mounted
            if (isMounted) {
              setServiceManager(globalThebeState.serviceManager);
              setSession(globalThebeState.session);
              setKernel(globalThebeState.kernel);
              setStatus(globalThebeState.status);
              setIsReady(globalThebeState.isReady);
            }
            
            // Wait a small delay to ensure state is updated
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Now reset the kernel state
            await resetKernelState();
            console.log('Kernel state reset completed for reused instance');
          } catch (error) {
            const kernelError = error as KernelError;
            if (kernelError?.type === 'cancelation') {
              console.log('Kernel reset was canceled');
              return;
            }
            console.error('Error resetting kernel state during initialization:', error);
          }
        }
        
        return;
      }

      // Mark as initializing
      globalThebeState.isInitializing = true;
      
      try {
        if (isMounted) {
          setIsScriptLoading(true);
          setStatus('starting');
        }
        
        // Load thebe-lite script
        await loadScript('/thebe/thebe-lite.min.js');
        
        // Wait for thebe-lite setup to complete
        if (window.setupThebeLite) {
          await window.setupThebeLite;
        }
        
        if (isMounted) {
          setIsScriptLoading(false);
        }
        
        // Connect to kernel and store the promise
        const connectPromise = connect();
        globalThebeState.initPromise = connectPromise;
        
        // Wait for connection
        await connectPromise;
        
        // Only update state if component is still mounted
        if (isMounted) {
          // Mark as initialized
          globalThebeState.isInitialized = true;
          globalThebeState.isInitializing = false;
          globalThebeState.initPromise = null;
          
          console.log('Kernel initialized successfully');
        }
      } catch (error) {
        const kernelError = error as KernelError;
        if (kernelError?.type === 'cancelation') {
          console.log('Kernel initialization was canceled');
          return;
        }
        console.error('Failed to initialize kernel:', error);
        if (isMounted) {
          setStatus('error');
        }
        globalThebeState.isInitializing = false;
        globalThebeState.initPromise = null;
      }
    };

    // Only initialize if not already initialized
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initializeKernel();
    }

    // Cleanup function
    return () => {
      isMounted = false; // Mark component as unmounted
      
      // Decrement reference count when component unmounts
      globalThebeState.referenceCount--;
      console.log(`ThebeProvider unmounted. Reference count: ${globalThebeState.referenceCount}`);
      
      // If this is the last instance, clean up the kernel after a delay
      // The delay prevents cleanup if the component is quickly remounted
      if (globalThebeState.referenceCount === 0) {
        // Clear any existing timeout
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
        }

        // Set new timeout
        cleanupTimeoutRef.current = setTimeout(() => {
          // Double-check reference count in case component was remounted during timeout
          if (globalThebeState.referenceCount === 0 && globalThebeState.kernel) {
            console.log('Cleaning up kernel resources...');
            
            // Send a gentle shutdown command to the kernel
            try {
              globalThebeState.kernel.requestExecute({ 
                code: 'import gc; gc.collect()' 
              });
            } catch (e) {
              console.warn('Error during kernel cleanup:', e);
            }
            
            // Don't fully reset the state to allow for quick reconnection
            // Just mark as not ready
            globalThebeState.isReady = false;
            globalThebeState.status = 'idle';
            
            console.log('Kernel resources cleaned up');
          }
        }, 5000); // 5 second delay before cleanup
      }
    };
  }, []);

  // Sync local state with global state when global state changes
  useEffect(() => {
    if (globalThebeState.isInitialized) {
      setServiceManager(globalThebeState.serviceManager);
      setSession(globalThebeState.session);
      setKernel(globalThebeState.kernel);
      setStatus(globalThebeState.status);
      setIsReady(globalThebeState.isReady);
      setKernelInfo(globalThebeState.kernelInfo);
      setKernelExecutionLog(globalThebeState.kernelExecutionLog);
    }
  }, [
    globalThebeState.isInitialized,
    globalThebeState.serviceManager,
    globalThebeState.session,
    globalThebeState.kernel,
    globalThebeState.status,
    globalThebeState.isReady,
    globalThebeState.kernelExecutionLog
  ]);

  // Add function to update log state and global state
  const addKernelLogEntry = useCallback((entryData: Omit<KernelExecutionLogEntry, 'timestamp'>) => {
    const newEntry: KernelExecutionLogEntry = {
      ...entryData,
      timestamp: Date.now(),
    };
    setKernelExecutionLog(prevLog => {
      // Avoid adding duplicate status messages immediately after each other
      if (entryData.type === 'status') {
        const lastEntry = prevLog[prevLog.length - 1];
        if (lastEntry && lastEntry.type === 'status' && lastEntry.content === entryData.content) {
          return prevLog; // Skip duplicate status
        }
      }
      const newLog = [...prevLog, newEntry];
      globalThebeState.kernelExecutionLog = newLog; // Keep global state in sync
      // Optional: Limit log size if needed
      // const MAX_LOG_SIZE = 1000;
      // if (newLog.length > MAX_LOG_SIZE) {
      //   newLog.splice(0, newLog.length - MAX_LOG_SIZE);
      // }
      return newLog;
    });
  }, []);

  const getKernelInfo = async (kernel: KernelConnection) => {
    if (!kernel) {
      console.warn('Kernel info not ready');
      return;
    }
    
    try {
      // Only install packages if not already installed
      if (!globalThebeState.kernelInfo.pythonVersion) {
        console.log('Installing packages...');
        // First install required packages
        const installFuture = kernel.requestExecute({
          code: `
import micropip
await micropip.install(['numpy', 'nbformat', 'pandas', 'matplotlib', 'plotly', 'hypha-rpc', 'pyodide-http', 'ipywidgets'])
import pyodide_http
pyodide_http.patch_all()
%matplotlib inline
import os
os.environ['CURRENT_URL'] = '${window.location.href}'
`
        });
        await installFuture.done;
      } else {
        console.log('Packages already installed, skipping installation...');
      }

      // Get version info
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
      const newKernelInfo = {
        pythonVersion,
        pyodideVersion
      };
      
      setKernelInfo(newKernelInfo);
      globalThebeState.kernelInfo = newKernelInfo;
    } catch (error) {
      console.error('Failed to get kernel info:', error);
    }
  };

  const connect = async () => {
    // If we already have a kernel and it's ready, just return it
    if (globalThebeState.kernel && globalThebeState.isReady) {
      console.log('Reusing existing kernel connection');
      setServiceManager(globalThebeState.serviceManager);
      setSession(globalThebeState.session);
      setKernel(globalThebeState.kernel);
      setStatus(globalThebeState.status);
      setIsReady(globalThebeState.isReady);
      return globalThebeState.kernel;
    }

    if (!window.thebeLite) {
      console.error('Thebe is not loaded yet');
      setStatus('error');
      setError(new Error('Thebe is not loaded yet'));
      throw new Error('Thebe is not loaded yet');
    }

    setStatus('starting');
    globalThebeState.status = 'starting';
    
    // Add retry logic for kernel initialization
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        // Configure JupyterLite settings
        const jupyterLiteConfig = {
          litePluginSettings: {
            '@jupyterlite/server-extension:service-worker': {
              enabled: true,
              path: '/service-worker.js',
              workerUrl: '/worker.js'
            },
            "@jupyterlite/pyodide-kernel-extension:kernel": {
              "pyodideUrl": "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js",
              "pipliteUrls": ["https://cdn.jsdelivr.net/npm/@jupyterlite/pyodide-kernel@0.5.2/pypi/all.json"],
              "pipliteWheelUrl": "https://cdn.jsdelivr.net/npm/@jupyterlite/pyodide-kernel@0.5.2/pypi/piplite-0.5.2-py3-none-any.whl"
            }
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
        globalThebeState.serviceManager = server;

        // Create a new session
        const session = await server.sessions.startNew({
          name: '',
          path: 'test.ipynb',
          type: 'notebook',
          kernel: { name: 'python' }
        });

        setSession(session);
        globalThebeState.session = session;

        // Wait for kernel to be ready
        const kernel = session.kernel;
        if (!kernel) throw new Error('Kernel not found');

        setKernel(kernel);
        globalThebeState.kernel = kernel;

        // Add error detection for Pyodide fatal errors
        const pyodideErrorHandler = (event: ErrorEvent) => {
          if (event.message.includes('Pyodide has suffered a fatal error')) {
            console.error('Detected Pyodide fatal error:', event);
            throw new Error('Pyodide fatal error detected');
          }
        };
        window.addEventListener('error', pyodideErrorHandler);

        // Wait for kernel to be ready using a Promise with timeout and error detection
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('error', pyodideErrorHandler);
            reject(new Error('Kernel startup timeout'));
          }, 120000);

          // Add a flag to track if we've detected a fatal error
          let hasFatalError = false;

          // Monitor console for Pyodide fatal errors
          const consoleErrorHandler = (event: any) => {
            const errorMsg = event?.message || event;
            if (typeof errorMsg === 'string' && 
                (errorMsg.includes('Pyodide has suffered a fatal error') || 
                 errorMsg.includes('t.push is not a function'))) {
              hasFatalError = true;
              console.error('Detected Pyodide fatal error in console:', errorMsg);
              clearTimeout(timeout);
              window.removeEventListener('error', pyodideErrorHandler);
              reject(new Error('Pyodide fatal error detected'));
            }
          };

          const originalConsoleError = console.error;
          console.error = (...args) => {
            consoleErrorHandler(args[0]);
            originalConsoleError.apply(console, args);
          };

          kernel.statusChanged.connect((_: unknown, status: 'idle' | 'busy' | 'starting' | 'error') => {
            console.log('Kernel status changed:', status);
            setStatus(status);
            globalThebeState.status = status;
            
            if (status === 'idle' && !hasFatalError) {
              clearTimeout(timeout);
              window.removeEventListener('error', pyodideErrorHandler);
              console.error = originalConsoleError;
              setIsReady(true);
              globalThebeState.isReady = true;
              resolve();
            } else if (status === 'error') {
              clearTimeout(timeout);
              window.removeEventListener('error', pyodideErrorHandler);
              console.error = originalConsoleError;
              reject(new Error('Kernel failed to start'));
            }
          });
        });
        
        // After kernel is ready, get kernel info
        await getKernelInfo(kernel);
        
        return kernel;
      } catch (error) {
        lastError = error as Error;
        console.error(`Error connecting to kernel (attempt ${retryCount + 1}/${maxRetries}):`, error);
        
        // Clean up the failed kernel instance
        if (globalThebeState.kernel) {
          try {
            await globalThebeState.kernel.requestExecute({ 
              code: 'import gc; gc.collect()' 
            });
          } catch (e) {
            console.warn('Error during kernel cleanup:', e);
          }
          globalThebeState.kernel = null;
        }
        if (globalThebeState.session) {
          globalThebeState.session = null;
        }
        
        // Reset state for retry
        setKernel(null);
        setSession(null);
        globalThebeState.isInitialized = false;
        globalThebeState.isInitializing = false;
        
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`Retrying kernel initialization in 2 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // If we've exhausted all retries, throw the last error
    setStatus('error');
    globalThebeState.status = 'error';
    throw lastError || new Error('Failed to initialize kernel after multiple attempts');
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
    const newStore = {
      ...outputStore,
      [key]: {
        content,
        type,
        timestamp: Date.now()
      }
    };
    
    setOutputStore(newStore);
    globalThebeState.outputStore = newStore;
    
    return key;
  };

  // Function to get output from store
  const getOutput = (key: string) => {
    const output = outputStore[key];
    return output ? { content: output.content, type: output.type } : null;
  };
  // Strip ANSI escape sequences from shortOutput
  const stripAnsi = (str: string) => {
    // This regex matches ANSI escape sequences
    return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
  };
  // Function to create a short representation of output
  const createShortContent = (content: string, type: string): string => {
    // content = stripAnsi(content);
    const maxLength = 4096; // Adjust this value as needed
    if (content.length <= maxLength) return content;
    
    switch (type) {
      case 'stdout':
      case 'stderr':
      case 'execute_input':
        const firstHalf = stripAnsi(content.substring(0, maxLength/2));
        const secondHalf = stripAnsi(content.substring(content.length - maxLength/2));
        const key = storeOutput(content, type);
        return `${firstHalf}... [truncated] ...${secondHalf} [Full output stored with key: ${key}]`;
      case 'html':
        return `[HTML content stored with key: ${storeOutput(content, type)}]`;
      case 'img':
        return `[Image stored with key: ${storeOutput(content, type)}]`;
      case 'svg':
        return `[SVG content stored with key: ${storeOutput(content, type)}]`;
      default:
        return `${content.substring(0, maxLength)}... [Full content stored with key: ${storeOutput(content, type)}]`;
    }
  };


  // Update executeCode function to remove status logging
  const executeCode = async (
    code: string,
    callbacks?: {
      onOutput?: (output: { type: string; content: string; short_content?: string; attrs?: any }) => void;
      onStatus?: (status: string) => void;
      cellId?: string; // Accept cellId
    },
    timeout: number | undefined = 600000
  ): Promise<void> => {
    const { onOutput, onStatus, cellId } = callbacks || {};
    timeout = timeout || 600000;
    // Get a ready kernel
    const currentKernel = kernel && isReady ? kernel : await connect();

    // Log input
    addKernelLogEntry({ type: 'input', content: code, cellId });
    onStatus?.('Executing code...');

    try {
      const future = currentKernel.requestExecute({ code });
      // Handle kernel messages
      future.onIOPub = (msg: KernelMessage) => {
        // console.log('Kernel message:', msg); // Keep for debugging if needed
        const msgType = msg.msg_type || msg.header.msg_type;
        let logEntryData: Omit<KernelExecutionLogEntry, 'timestamp'> | null = null;

        switch (msgType) {
          case 'stream':
            const streamContent = msg.content.text;
            logEntryData = { type: 'output', content: streamContent, cellId };
            onOutput?.({
              type: msg.content.name || 'stdout',
              content: streamContent,
              short_content: createShortContent(streamContent, msg.content.name || 'stdout')
            });
            break;
          case "execute_input":
            // Input is already logged above
            onOutput?.({
              type: 'execute_input',
              content: msg.content.code,
              short_content: createShortContent(msg.content.code, 'execute_input')
            });
            break;
          case 'display_data':
          case 'execute_result':
            // Handle rich display data
            const data = msg.content.data;
            let outputContent = '';
            let outputType = 'stdout';
            if (data['text/html']) {
              outputContent = data['text/html'];
              outputType = 'html';
            } else if (data['image/png']) {
              outputContent = `data:image/png;base64,${data['image/png']}`;
              outputType = 'img';
            } else if (data['image/jpeg']) {
              outputContent = `data:image/jpeg;base64,${data['image/jpeg']}`;
              outputType = 'img';
            } else if (data['image/svg+xml']) {
              outputContent = data['image/svg+xml'];
              outputType = 'svg';
            } else if (data['text/plain']) {
              outputContent = data['text/plain'];
              outputType = 'stdout';
            }
            if (outputContent) {
              logEntryData = { type: 'output', content: outputContent, cellId };
              onOutput?.({
                type: outputType,
                content: outputContent,
                short_content: createShortContent(outputContent, outputType)
              });
            }
            break;
          case 'error':
            const errorText = msg.content.traceback.join('\n');
            logEntryData = { type: 'error', content: errorText, cellId };
            onOutput?.({
              type: 'stderr',
              content: errorText,
              short_content: createShortContent(errorText, 'stderr')
            });
            onStatus?.('Error');
            break;
          case 'status':
            const state = msg.content.execution_state;
            let statusText = '';
            if (state === 'busy') {
              statusText = 'Running...';
            } else if (state === 'idle') {
              statusText = 'Completed';
            }
            if (statusText) {
              onStatus?.(statusText);
            }
            break;
        }
        if (logEntryData) {
          addKernelLogEntry(logEntryData); // Add the log entry
        }
      };
      // Wait for execution to complete with a timeout (use Promise.race)
      // await future.done;
      await Promise.race([future.done, new Promise((_, reject) => setTimeout(() => reject(new Error(`Execution timeout after ${timeout/1000}s`)), timeout))]);

    } catch (error) {
      console.error('Error executing code:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      addKernelLogEntry({ type: 'error', content: `Execution failed: ${errorMsg}`, cellId });
      onStatus?.('Error');
      throw error;
    }
  };

  const executeCodeWithDOMOutput = async (code: string, outputElement: HTMLElement, callbacks?: {
    onOutput?: (output: { type: string; content: string; short_content?: string; attrs?: any }) => void;
    onStatus?: (status: string) => void;
    cellId?: string; // Accept cellId
  }) => {
    const { onOutput, onStatus, cellId } = callbacks || {};

    // Get a ready kernel
    const currentKernel = kernel && isReady ? kernel : await connect();

    // Log input
    addKernelLogEntry({ type: 'input', content: code, cellId });
    onStatus?.('Executing code...');

    try {
      // Clear previous output
      outputElement.innerHTML = '';
      
      // Create a unique ID for this output area
      const outputId = `output-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      outputElement.id = outputId;
      
      // Execute the setup code first
      const setupCodeStr = getSetupCode(outputId);
      const setupFuture = currentKernel.requestExecute({ code: setupCodeStr });
      await setupFuture.done;

      // Now execute the actual code
      const future = currentKernel.requestExecute({ code });
      
      // Handle kernel messages
      future.onIOPub = (msg: KernelMessage) => {
        // console.log('Kernel message:', msg); // Keep for debugging if needed
        const msgType = msg.msg_type || msg.header.msg_type;
        let logEntryData: Omit<KernelExecutionLogEntry, 'timestamp'> | null = null;

        switch (msgType) {
          case 'stream':
            const streamContent = msg.content.text;
            logEntryData = { type: 'output', content: streamContent, cellId };
            const streamDiv = document.createElement('pre');
            streamDiv.className = 'stream-output';
            streamDiv.textContent = streamContent;
            outputElement.appendChild(streamDiv);
            onOutput?.({
              type: msg.content.name || 'stdout',
              content: streamContent,
              short_content: createShortContent(streamContent, msg.content.name || 'stdout')
            });
            break;
          case 'display_data':
          case 'execute_result':
            // Create a container for this output to preserve order
            const outputContainer = document.createElement('div');
            outputContainer.className = 'execute-result';
            
            // Handle each mime type in order of preference
            const data = msg.content.data;
            let hasOutput = false;

            if (data['text/html']) {
              const div = document.createElement('div');
              div.innerHTML = data['text/html'];
              
              logEntryData = { type: 'output', content: data['text/html'], cellId };
              onOutput?.({
                type: 'html',
                content: data['text/html'],
                short_content: createShortContent(data['text/html'], 'html')
              });
              
              // Execute any scripts in the HTML
              executeScripts(div);
              outputContainer.appendChild(div);
              hasOutput = true;
            }
            
            if (data['image/png']) {
              const img = document.createElement('img');
              const imgContent = `data:image/png;base64,${data['image/png']}`;
              img.src = imgContent;
              outputContainer.appendChild(img);
              
              logEntryData = { type: 'output', content: imgContent, cellId };
              onOutput?.({
                type: 'img',
                content: imgContent,
                short_content: createShortContent(imgContent, 'img')
              });
              hasOutput = true;
            }
            
            if (data['text/plain'] && !hasOutput) {
              const plainContent = data['text/plain'];
              const pre = document.createElement('pre');
              pre.textContent = plainContent;
              outputContainer.appendChild(pre);
              
              logEntryData = { type: 'output', content: plainContent, cellId };
              onOutput?.({
                type: 'stdout',
                content: plainContent,
                short_content: createShortContent(plainContent, 'stdout')
              });
              hasOutput = true;
            }

            // Only append if we actually have content
            if (hasOutput) {
              outputElement.appendChild(outputContainer);
            }
            break;
          case 'error':
            const errorText = msg.content.traceback.join('\n');
            const errorDiv = document.createElement('pre');
            errorDiv.className = 'error-output';
            errorDiv.style.color = 'red';
            // parse the errorText to html
            const htmlWithAnsi = processTextOutput(errorText);
            errorDiv.innerHTML = htmlWithAnsi;
            outputElement.appendChild(errorDiv);
            
            logEntryData = { type: 'error', content: errorText, cellId };
            onOutput?.({
              type: 'stderr',
              content: errorText,
              short_content: createShortContent(errorText, 'stderr')
            });
            onStatus?.('Error');
            break;
          case 'status':
            const state = msg.content.execution_state;
            let statusText = '';
            if (state === 'busy') {
              statusText = 'Running...';
            } else if (state === 'idle') {
              statusText = 'Completed';
            }
            if (statusText) {
              onStatus?.(statusText);
            }
            break;
        }
        if (logEntryData) {
          addKernelLogEntry(logEntryData);
        }
      };
      
      // Wait for execution to complete
      await future.done;
      
      // Clean up any global references to prevent memory leaks
      if (window.jupyterDisplayData && window.jupyterDisplayData[outputId]) {
        delete window.jupyterDisplayData[outputId];
      }
    } catch (error) {
      console.error('Error executing code:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      addKernelLogEntry({ type: 'error', content: `Execution failed: ${errorMsg}`, cellId });
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
      globalThebeState.status = 'idle';
    } catch (error) {
      console.error('Failed to interrupt kernel:', error);
      throw error;
    }
  };

  const restartKernel = async () => {
    try {
      setStatus('starting');
      globalThebeState.status = 'starting';
      
      // Clear the current kernel state
      if (globalThebeState.kernel) {
        globalThebeState.kernel = null;
      }
      if (globalThebeState.session) {
        globalThebeState.session = null;
      }
      setKernel(null);
      setSession(null);
      
      // Reset initialization flags
      globalThebeState.isInitialized = false;
      globalThebeState.isInitializing = false;
      globalThebeState.initPromise = null;
      
      // Create new kernel connection
      const newKernel = await connect();
      
      // Get kernel info for the new kernel
      await getKernelInfo(newKernel);
      
      setStatus('idle');
      globalThebeState.status = 'idle';
      
      console.log('Kernel restarted successfully');
    } catch (error) {
      console.error('Failed to restart kernel:', error);
      setStatus('error');
      globalThebeState.status = 'error';
      throw error;
    }
  };

  // Add resetKernelState function
  const resetKernelState = async (): Promise<void> => {
    if (!kernel || !isReady) {
      console.warn('Cannot reset kernel state: kernel not ready');
      return;
    }

    try {
      console.log('Resetting kernel state...');
      setStatus('busy');
      globalThebeState.status = 'busy';

      // Execute code to clear all variables and reset kernel state
      const resetCode = `
try:
    # First import required modules
    import sys
    import gc
    from types import ModuleType
    
    # First, ensure IPython display system is properly initialized
    # This will create any missing variables needed for display
    try:
        from IPython.display import display, HTML
        display(HTML(""))
    except Exception as e:
        print(f"Warning: Could not initialize IPython display: {str(e)}")
    
    # Get all variables in the global namespace
    all_vars = list(globals().keys())
    
    # Variables to keep (Python builtins, essential modules, and IPython display system)
    keep_vars = [
        # Python builtins
        '__name__', '__doc__', '__package__', '__loader__', '__spec__', 
        '__builtin__', '__builtins__', 'type', 'object', 'open',
        
        # IPython system
        'get_ipython', 'exit', 'quit', 'In', 'Out', '_ih', '_oh', '_dh',
        '_', '__', '___', '_i', '_ii', '_iii', '_i1', '_i2', '_i3',
        
        # Modules we want to keep
        'sys', 'gc', 'ModuleType',
        
        # Display-related
        'display', 'HTML', 'Javascript', 'Markdown', 'Math', 'Latex',
        'Image', 'JSON', 'GeoJSON', 'Audio', 'Video'
    ]
    
    # Delete user-defined variables, but keep system ones
    for var in all_vars:
        if var not in keep_vars:
            try:
                # Skip modules to avoid reimporting them
                if var in globals() and not isinstance(globals()[var], ModuleType):
                    del globals()[var]
            except Exception as e:
                print(f"Warning: Error deleting variable {var}: {str(e)}")
    
    # Instead of clearing IPython namespace completely, just remove user variables
    try:
        ip = get_ipython()
        if hasattr(ip, 'user_ns'):
            # Get user variables (excluding system ones)
            user_vars = [var for var in ip.user_ns if not var.startswith('_') and 
                         var not in keep_vars and 
                         not isinstance(ip.user_ns[var], ModuleType)]
            
            # Delete only user variables
            for var in user_vars:
                if var in ip.user_ns:
                    del ip.user_ns[var]
            
            # Make sure essential display variables exist
            if '_oh' not in ip.user_ns:
                ip.user_ns['_oh'] = {}
            
            print(f"Cleared {len(user_vars)} user variables from IPython namespace")
    except Exception as e:
        print(f"Warning: Error cleaning IPython namespace: {str(e)}")
    
    # Force garbage collection
    gc.collect()
    
    # Reinitialize IPython display system
    try:
        from IPython.display import display, HTML
        display(HTML("<!-- Display system reinitialized -->"))
    except Exception as e:
        print(f"Warning: Could not reinitialize display system: {str(e)}")
    
    print("Kernel state has been reset. User-defined variables have been cleared.")
except Exception as e:
    print(f"Error during kernel reset: {str(e)}")
`;

      const future = kernel.requestExecute({ code: resetCode });
      
      // Handle kernel messages
      future.onIOPub = (msg: KernelMessage) => {
        console.log('Reset kernel message:', msg);
        const msgType = msg.msg_type || msg.header.msg_type;
        
        if (msgType === 'stream' && msg.content.name === 'stdout') {
          console.log('Reset output:', msg.content.text);
        } else if (msgType === 'error') {
          console.error('Error during reset:', msg.content.traceback.join('\n'));
        }
      };
      
      // Wait for execution to complete
      await future.done;
      
      // Clear output store
      const newOutputStore = {};
      setOutputStore(newOutputStore);
      globalThebeState.outputStore = newOutputStore;
      
      // Run a simple test to verify the display system is working
      const testCode = `
try:
    from IPython.display import HTML
    HTML("<p>Display system test</p>")
except Exception as e:
    print(f"Display system test failed: {str(e)}")
`;
      
      const testFuture = kernel.requestExecute({ code: testCode });
      await testFuture.done;
      
      setStatus('idle');
      globalThebeState.status = 'idle';
      console.log('Kernel state reset completed');
    } catch (error) {
      console.error('Error resetting kernel state:', error);
      setStatus('error');
      globalThebeState.status = 'error';
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
        executeCodeWithDOMOutput,
        interruptKernel,
        restartKernel,
        resetKernelState,
        kernelInfo,
        outputStore,
        storeOutput,
        getOutput,
        kernelExecutionLog,
        addKernelLogEntry,
      }}
    >
      {children}
    </ThebeContext.Provider>
  );
}; 