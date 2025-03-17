// Define types for JupyterLab services without direct imports
// This avoids the crypto dependency issue

export interface KernelMessage {
  header: {
    msg_type: string;
  };
  content: any;
  msg_type?: string;
}

export interface KernelConnection {
  requestExecute: (options: { code: string }) => {
    done: Promise<any>;
    onIOPub: ((msg: KernelMessage) => void) | ((callback: (msg: KernelMessage) => void) => void);
  };
  statusChanged: {
    connect: (callback: (sender: any, status: KernelStatus) => void) => void;
  };
  status: KernelStatus;
}

export interface SessionConnection {
  kernel: KernelConnection | null;
}

export interface ServiceManager {
  sessions: {
    startNew: (options: {
      path: string;
      type: string;
      name: string;
      kernel: { name: string };
    }) => Promise<SessionConnection>;
  };
}

export type KernelStatus = 'idle' | 'busy' | 'starting' | 'error';

export interface KernelInfo {
  pythonVersion?: string;
  pyodideVersion?: string;
}

export class KernelManager {
  private serviceManager: ServiceManager | null = null;
  private session: SessionConnection | null = null;
  private kernel: KernelConnection | null = null;
  private status: KernelStatus = 'idle';
  private isReady: boolean = false;
  private kernelInfo: KernelInfo = {};
  private statusCallbacks: ((status: KernelStatus) => void)[] = [];

  constructor() {}

  public getKernel(): KernelConnection | null {
    return this.kernel;
  }

  public getStatus(): KernelStatus {
    return this.status;
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  public getKernelInfo(): KernelInfo {
    return this.kernelInfo;
  }

  public onStatusChange(callback: (status: KernelStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  private setStatus(status: KernelStatus): void {
    this.status = status;
    this.statusCallbacks.forEach(callback => callback(status));
  }

  public async connect(options: {
    serverSettings?: any;
    kernelName?: string;
  }): Promise<KernelConnection> {
    if (this.kernel && this.isReady) {
      console.log("Kernel already connected and ready");
      return this.kernel;
    }

    this.setStatus('starting');
    console.log("Starting kernel connection...");

    try {
      if (options.serverSettings) {
        // For Binder or remote kernels
        // We would need to use @jupyterlab/services directly here
        // Since we're avoiding direct imports, we'll throw an error
        throw new Error('Binder backend not implemented in this version');
      } else {
        // For ThebelLite
        if (!window.thebeLite) {
          throw new Error('ThebelLite not loaded');
        }

        console.log("Using ThebelLite to start kernel...");
        const server = await window.thebeLite.startJupyterLiteServer({
          baseUrl: '/',
          appUrl: '/',
          assetsUrl: '/thebe/',
          fullMathjaxUrl: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js',
        });

        this.serviceManager = server;
        console.log("ThebelLite server started, creating session...");
        
        const session = await server.sessions.startNew({
          name: '',
          path: 'test.ipynb',
          type: 'notebook',
          kernel: { name: options.kernelName || 'python' }
        });

        this.session = session;
        this.kernel = session.kernel;
        
        console.log("Session and kernel created, waiting for ready state...");
      }

      if (!this.kernel) {
        throw new Error('Failed to create kernel');
      }

      // Wait for kernel to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Kernel startup timeout'));
        }, 120000);

        // Check if kernel is already idle
        if (this.kernel!.status === 'idle') {
          console.log("Kernel already in idle state, considering it ready");
          clearTimeout(timeout);
          this.isReady = true;
          this.setStatus('idle');
          resolve();
          return;
        }

        console.log("Connecting to kernel status change events...");
        this.kernel!.statusChanged.connect((_: unknown, status: KernelStatus) => {
          console.log(`Kernel status changed to: ${status}`);
          this.setStatus(status);
          if (status === 'idle') {
            console.log("Kernel is now idle, marking as ready");
            clearTimeout(timeout);
            this.isReady = true;
            resolve();
          } else if (status === 'error') {
            console.error("Kernel error occurred during startup");
            clearTimeout(timeout);
            reject(new Error('Kernel failed to start'));
          }
        });
      });

      // Get kernel info
      await this.fetchKernelInfo();
      
      console.log("Kernel is ready and info fetched");
      return this.kernel;
    } catch (error) {
      console.error("Error during kernel connection:", error);
      this.setStatus('error');
      throw error;
    }
  }

  private async fetchKernelInfo(): Promise<void> {
    if (!this.kernel || !this.isReady) {
      return;
    }

    try {
      const messages = await this.executeCode(`
import sys
import pyodide
print(f"{sys.version.split()[0]}")
      `);

      // Extract Python version from output
      for (const msg of messages) {
        if (msg.header.msg_type === 'stream' && msg.content.name === 'stdout') {
          this.kernelInfo.pythonVersion = msg.content.text.trim();
          break;
        }
      }
    } catch (error) {
      console.error('Error fetching kernel info:', error);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.kernel) {
      try {
        await this.kernel.requestExecute({ code: 'exit()' }).done;
      } catch (error) {
        console.warn('Error shutting down kernel:', error);
      }
    }
    this.kernel = null;
    this.session = null;
    this.isReady = false;
    this.setStatus('idle');
  }

  public async restart(): Promise<void> {
    await this.shutdown();
    if (this.serviceManager) {
      await this.connect({});
    }
  }

  public async executeCode(code: string): Promise<KernelMessage[]> {
    if (!this.kernel || !this.isReady) {
      throw new Error('Kernel not ready');
    }

    const messages: KernelMessage[] = [];
    
    try {
      // Add error handling wrapper around the code
      const wrappedCode = `
try:
    ${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    import traceback
    import sys
    print("PYTHON_EXECUTION_ERROR:", str(e), file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
`;

      const future = this.kernel.requestExecute({ code: wrappedCode });

      return new Promise((resolve, reject) => {
        let hasError = false;
        
        future.onIOPub = (msg: KernelMessage) => {
          messages.push(msg);
          
          // Check for Python execution errors
          const msgType = msg.msg_type || msg.header.msg_type;
          if (msgType === 'stream' && 
              msg.content.name === 'stderr' && 
              typeof msg.content.text === 'string' && 
              msg.content.text.includes('PYTHON_EXECUTION_ERROR:')) {
            hasError = true;
            
            // Create a proper error message
            const errorMsg: KernelMessage = {
              header: { msg_type: 'error' },
              content: {
                ename: 'PythonExecutionError',
                evalue: msg.content.text.replace('PYTHON_EXECUTION_ERROR:', '').trim(),
                traceback: [msg.content.text]
              },
              msg_type: 'error'
            };
            
            messages.push(errorMsg);
          }
        };

        future.done
          .then(() => {
            // If we detected a Python error, make sure it's properly represented
            if (hasError && !messages.some(msg => (msg.msg_type || msg.header.msg_type) === 'error')) {
              const errorMsg: KernelMessage = {
                header: { msg_type: 'error' },
                content: {
                  ename: 'PythonExecutionError',
                  evalue: 'An error occurred during execution',
                  traceback: ['Check the stderr output for details']
                },
                msg_type: 'error'
              };
              messages.push(errorMsg);
            }
            resolve(messages);
          })
          .catch((error) => {
            console.error('Kernel execution error:', error);
            
            // Add an error message to the output
            const errorMsg: KernelMessage = {
              header: { msg_type: 'error' },
              content: {
                ename: 'KernelExecutionError',
                evalue: error.toString(),
                traceback: [error.toString()]
              },
              msg_type: 'error'
            };
            
            messages.push(errorMsg);
            resolve(messages); // Resolve with the error message instead of rejecting
          });
      });
    } catch (error: any) {
      console.error('Critical error in executeCode:', error);
      
      // Return a message with the error instead of throwing
      return [{
        header: { msg_type: 'error' },
        content: {
          ename: 'CriticalExecutionError',
          evalue: error.toString(),
          traceback: [error.toString()]
        },
        msg_type: 'error'
      }];
    }
  }

  public async resetVariables(): Promise<void> {
    if (!this.kernel || !this.isReady) {
      console.warn('Cannot reset variables: kernel not ready');
      return;
    }

    console.log('Resetting kernel variables...');

    try {
      const resetCode = `
import sys
import gc
from types import ModuleType

all_vars = list(globals().keys())
keep_vars = [
    '__name__', '__doc__', '__package__', '__loader__', '__spec__', 
    '__builtin__', '__builtins__', 'type', 'object', 'gc', 'sys', 'ModuleType'
]

for var in all_vars:
    if var not in keep_vars:
        try:
            if var in globals() and not isinstance(globals()[var], ModuleType):
                del globals()[var]
        except Exception as e:
            print(f"Warning: Error deleting variable {var}: {str(e)}")

gc.collect()
print("Variables reset complete")
`;

      const messages = await this.executeCode(resetCode);
      messages.forEach(msg => {
        if (msg.header.msg_type === 'error') {
          console.error('Kernel error during variable reset:', msg.content);
        }
      });

      console.log('Kernel variables reset completed successfully');
    } catch (error) {
      console.error('Critical error resetting kernel variables:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const kernelManager = new KernelManager(); 