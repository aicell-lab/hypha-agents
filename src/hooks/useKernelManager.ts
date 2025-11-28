/**
 * Hook for managing kernel state and operations using web-python-kernel
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { KernelManager as KernelManagerType, KernelInfo, KernelExecutionLog, ExecuteCodeCallbacks } from '../utils/agentLabTypes';
import { createKernelResetCode } from '../utils/kernelUtils';
import { showToast } from '../utils/notebookUtils';

interface UseKernelManagerProps {
  server?: any; // Keep for API compatibility but won't be used
  clearRunningState?: () => void;
  onKernelReady?: (executeCode: (code: string, callbacks?: ExecuteCodeCallbacks, timeout?: number) => Promise<void>) => void;
}

export const useKernelManager = ({ server, clearRunningState, onKernelReady }: UseKernelManagerProps): KernelManagerType => {
  const [isReady, setIsReady] = useState(false);
  const [kernelStatus, setKernelStatus] = useState<'idle' | 'busy' | 'starting' | 'error'>('starting');
  const [executeCode, setExecuteCode] = useState<((code: string, callbacks?: ExecuteCodeCallbacks, timeout?: number) => Promise<void>) | null>(null);
  const [kernelInfo, setKernelInfo] = useState<KernelInfo>({});
  const [kernelExecutionLog, setKernelExecutionLog] = useState<KernelExecutionLog[]>([]);

  // Add ref to store executeCode function to avoid circular dependencies
  const executeCodeRef = useRef<any>(null);
  // Add ref to store the web-python-kernel manager and kernel ID
  const kernelManagerRef = useRef<any>(null);
  const currentKernelIdRef = useRef<string | null>(null);
  const currentKernelRef = useRef<any>(null);
  // Add ref to prevent multiple initializations
  const isInitializingRef = useRef(false);
  // Add ref to store onKernelReady callback to prevent dependency issues
  const onKernelReadyRef = useRef(onKernelReady);
  // Add ref to track mounted paths for auto-sync
  const mountedPathsRef = useRef<Set<string>>(new Set());

  // Update the onKernelReady ref when it changes
  useEffect(() => {
    onKernelReadyRef.current = onKernelReady;
  }, [onKernelReady]);

  // Function to update kernel log
  const addKernelLogEntry = useCallback((entryData: Omit<KernelExecutionLog, 'timestamp'>) => {
    const newEntry = {
      ...entryData,
      timestamp: Date.now(),
    };
    setKernelExecutionLog(prevLog => [...prevLog, newEntry]);
  }, []);

  // Function to dynamically load web-python-kernel module
  const loadWebPythonKernel = useCallback(async () => {
    if (kernelManagerRef.current) {
      return kernelManagerRef.current;
    }

    try {
      // Dynamically import the web-python-kernel module
      console.log('[Web Python Kernel] Loading kernel module...');
      const baseUrl = process.env.PUBLIC_URL || '';
      const WebPythonKernel = await import(/* webpackIgnore: true */ `${baseUrl}/web-python-kernel.mjs`);

      // Store in window for compatibility with other code that might check for it
      (window as any).WebPythonKernel = WebPythonKernel;
      window.dispatchEvent(new Event('web-python-kernel-loaded'));

      console.log('[Web Python Kernel] Module loaded successfully');

      const { KernelManager, KernelMode, KernelLanguage, KernelEvents } = WebPythonKernel;

      // Create kernel manager with local worker URL
      const workerUrl = `${process.env.PUBLIC_URL || ''}/kernel.worker.js`;

      const manager = new KernelManager({
        allowedKernelTypes: [
          { mode: KernelMode.WORKER, language: KernelLanguage.PYTHON }
        ],
        interruptionMode: 'auto',
        workerUrl, // Use local worker file to avoid CORS issues
        pool: {
          enabled: false,
          poolSize: 0,
          autoRefill: false
        }
      });

      kernelManagerRef.current = { manager, KernelMode, KernelLanguage, KernelEvents };
      return kernelManagerRef.current;
    } catch (error) {
      console.error('[Web Python Kernel] Failed to load kernel module:', error);
      throw error;
    }
  }, []);

  // Helper function to sync all mounted filesystems
  const syncAllMountedPaths = useCallback(async () => {
    const kernel = currentKernelRef.current;
    if (!kernel || mountedPathsRef.current.size === 0) {
      return;
    }

    const actualKernel = kernel.kernel || kernel;
    if (typeof actualKernel.syncFileSystem !== 'function') {
      return;
    }

    try {
      for (const mountPath of mountedPathsRef.current) {
        console.log(`[Web Python Kernel] Auto-syncing filesystem at ${mountPath}...`);
        await actualKernel.syncFileSystem(mountPath);
      }
    } catch (error) {
      console.error('[Web Python Kernel] Error auto-syncing filesystem:', error);
    }
  }, []);

  // Create executeCode function that wraps the kernel execution
  const createExecuteCodeFunction = useCallback((manager: any, kernelId: string) => {
    return async (code: string, callbacks?: ExecuteCodeCallbacks, _timeout?: number) => {
      let hasError = false;

      try {
        setKernelStatus('busy');

        const stream = manager.executeStream(kernelId, code);

        for await (const event of stream) {
          // DEBUG: Log all events to understand the structure
          console.log('[Web Python Kernel] Event received:', {
            type: event.type,
            data: event.data,
            hasImagePng: event.data?.data?.['image/png'] ? 'YES' : 'NO',
            hasTextHtml: event.data?.data?.['text/html'] ? 'YES' : 'NO',
            hasTextPlain: event.data?.data?.['text/plain'] ? 'YES' : 'NO',
            dataKeys: event.data?.data ? Object.keys(event.data.data) : []
          });

          // Handle different event types
          switch (event.type) {
            case 'stream':
              if (event.data.name === 'stdout' && callbacks?.onOutput) {
                callbacks.onOutput({
                  type: 'stdout',
                  content: event.data.text,
                  short_content: event.data.text
                });
              } else if (event.data.name === 'stderr' && callbacks?.onOutput) {
                callbacks.onOutput({
                  type: 'stderr',
                  content: event.data.text,
                  short_content: event.data.text
                });
              }
              break;

            case 'execute_result':
              console.log('[Web Python Kernel] execute_result event data:', event.data);
              if (event.data && event.data.data) {
                const textPlain = event.data.data['text/plain'];

                // Don't display None results (standard Jupyter behavior)
                if (textPlain && textPlain !== 'None' && callbacks?.onOutput) {
                  callbacks.onOutput({
                    type: 'result',
                    content: textPlain,
                    short_content: textPlain
                  });
                } else if (!textPlain && callbacks?.onOutput) {
                  // Fallback to JSON stringify if text/plain is missing
                  const result = JSON.stringify(event.data.data);
                  callbacks.onOutput({
                    type: 'result',
                    content: result,
                    short_content: result
                  });
                }
              }
              break;

            case 'display_data':
              console.log('[Web Python Kernel] display_data event:', {
                hasData: !!event.data,
                dataKeys: event.data?.data ? Object.keys(event.data.data) : [],
                imagePngLength: event.data?.data?.['image/png']?.length,
                textHtmlLength: event.data?.data?.['text/html']?.length,
                fullData: event.data
              });

              if (event.data && event.data.data && callbacks?.onOutput) {
                if (event.data.data['image/png']) {
                  console.log('[Web Python Kernel] Processing image/png, length:', event.data.data['image/png'].length);
                  callbacks.onOutput({
                    type: 'img', // Changed from 'image' to 'img' to match JupyterOutput expectations
                    content: `data:image/png;base64,${event.data.data['image/png']}`,
                    short_content: '[Image]'
                  });
                } else if (event.data.data['text/html']) {
                  console.log('[Web Python Kernel] Processing text/html');
                  callbacks.onOutput({
                    type: 'html',
                    content: event.data.data['text/html'],
                    short_content: '[HTML]'
                  });
                } else if (event.data.data['text/plain']) {
                  console.log('[Web Python Kernel] Processing text/plain from display_data');
                  const plainText = event.data.data['text/plain'];
                  callbacks.onOutput({
                    type: 'result',
                    content: plainText,
                    short_content: plainText
                  });
                }
              }
              break;

            case 'execute_error':
            case 'error':
              hasError = true;
              // Output error messages using onOutput callback
              if (callbacks?.onOutput) {
                const errorMsg = event.data
                  ? `${event.data.ename || 'Error'}: ${event.data.evalue || 'Unknown error'}`
                  : 'Execution failed';
                callbacks.onOutput({
                  type: 'error',
                  content: errorMsg,
                  short_content: errorMsg
                });
              }
              if (event.data?.traceback && callbacks?.onOutput) {
                event.data.traceback.forEach((line: string) => {
                  callbacks.onOutput?.({
                    type: 'stderr',
                    content: line,
                    short_content: line
                  });
                });
              }
              break;
          }
        }

        setKernelStatus('idle');

        // Sync all mounted filesystems after execution
        try {
          const kernel = currentKernelRef.current;
          if (kernel && mountedPathsRef.current.size > 0) {
            const actualKernel = kernel.kernel || kernel;
            if (typeof actualKernel.syncFileSystem === 'function') {
              for (const mountPath of mountedPathsRef.current) {
                console.log(`[Web Python Kernel] Auto-syncing filesystem at ${mountPath}...`);
                await actualKernel.syncFileSystem(mountPath);
              }
            }
          }
        } catch (syncError) {
          console.error('[Web Python Kernel] Error auto-syncing filesystem:', syncError);
        }

        // Signal completion via onStatus callback
        if (callbacks?.onStatus) {
          if (hasError) {
            callbacks.onStatus('Error');
          } else {
            callbacks.onStatus('Completed');
          }
        }

      } catch (error) {
        setKernelStatus('idle');
        console.error('[Web Python Kernel] Execution error:', error);

        if (callbacks?.onOutput) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          callbacks.onOutput({
            type: 'error',
            content: errorMsg,
            short_content: errorMsg
          });
        }

        // Signal error via onStatus callback
        if (callbacks?.onStatus) {
          callbacks.onStatus('Error');
        }
      }
    };
  }, []);

  // Function to initialize the executeCode function
  const initializeExecuteCode = useCallback((manager: any, kernelInfo: KernelInfo) => {
    const kernelId = kernelInfo.kernelId || kernelInfo.id;
    if (!kernelId) {
      console.error('[Web Python Kernel] Cannot initialize executeCode: no kernel ID');
      return;
    }

    const executeCodeFn = createExecuteCodeFunction(manager, kernelId);

    setExecuteCode(() => executeCodeFn);
    executeCodeRef.current = executeCodeFn;

    // Call onKernelReady callback
    onKernelReadyRef.current?.(executeCodeFn);
  }, [createExecuteCodeFunction]);

  // Kernel initialization
  useEffect(() => {
    async function initializeKernel() {
      // Prevent multiple concurrent initializations
      if (isInitializingRef.current) {
        console.log('[Web Python Kernel] Initialization already in progress, skipping...');
        return;
      }

      // Mark as initializing
      isInitializingRef.current = true;

      const initTimeout = setTimeout(() => {
        console.error('[Web Python Kernel] Initialization timeout after 180 seconds');
        setKernelStatus('error');
        setIsReady(false);
        showToast('Kernel initialization timed out. Please try restarting.', 'error');
        isInitializingRef.current = false;
      }, 180000); // 180 second timeout

      try {
        setKernelStatus('starting');
        console.log('[Web Python Kernel] Initializing web-python-kernel...');

        // Load the kernel module
        const { manager, KernelMode, KernelLanguage, KernelEvents } = await loadWebPythonKernel();

        console.log('[Web Python Kernel] Creating kernel...');

        // Create a new kernel
        const kernelId = await manager.createKernel({
          mode: KernelMode.WORKER,
          lang: KernelLanguage.PYTHON,
          autoSyncFs: true,
        });

        console.log('[Web Python Kernel] Created kernel:', kernelId);

        // Store kernel ID and kernel instance
        currentKernelIdRef.current = kernelId;
        const kernel = manager.kernels?.[kernelId] || manager.getKernel?.(kernelId);
        currentKernelRef.current = kernel;

        // Set up event listeners
        manager.onKernelEvent(kernelId, KernelEvents.KERNEL_BUSY, () => {
          setKernelStatus('busy');
        });

        manager.onKernelEvent(kernelId, KernelEvents.KERNEL_IDLE, () => {
          setKernelStatus('idle');
        });

        // Clear the timeout since we succeeded
        clearTimeout(initTimeout);

        // Update state
        const newKernelInfo = { kernelId, id: kernelId };
        setKernelInfo(newKernelInfo);
        setKernelStatus('idle');
        setIsReady(true);

        // Initialize the executeCode function
        initializeExecuteCode(manager, newKernelInfo);

        console.log('[Web Python Kernel] Kernel initialization completed successfully');

        // Reset initialization flag
        isInitializingRef.current = false;
      } catch (error) {
        clearTimeout(initTimeout);
        console.error('[Web Python Kernel] Initialization error:', error);
        setKernelStatus('error');
        setIsReady(false);

        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Kernel initialization failed: ${errorMessage}`, 'error');

        // Reset initialization flag on error
        isInitializingRef.current = false;
      }
    }

    initializeKernel();
  }, [loadWebPythonKernel, initializeExecuteCode]);

  // Function to destroy current kernel
  const destroyCurrentKernel = useCallback(async () => {
    const manager = kernelManagerRef.current?.manager;
    const kernelId = currentKernelIdRef.current;

    if (!manager || !kernelId) return;

    try {
      console.log('[Web Python Kernel] Destroying current kernel:', kernelId);
      await manager.destroyKernel(kernelId);
      currentKernelIdRef.current = null;
    } catch (error) {
      console.warn('[Web Python Kernel] Error destroying kernel:', error);
    }
  }, []);

  // Function to interrupt kernel execution
  const interruptKernel = useCallback(async () => {
    const manager = kernelManagerRef.current?.manager;
    const kernelId = currentKernelIdRef.current;

    if (!manager || !kernelId) {
      showToast('No active kernel to interrupt', 'warning');
      return false;
    }

    try {
      showToast('Interrupting kernel execution...', 'loading');
      console.log('[Web Python Kernel] Interrupting kernel:', kernelId);
      const success = await manager.interruptKernel(kernelId);

      if (success) {
        showToast('Kernel execution interrupted', 'success');
      } else {
        showToast('Failed to interrupt kernel execution', 'error');
      }

      return success;
    } catch (error) {
      console.error('[Web Python Kernel] Error interrupting kernel:', error);
      showToast('Error interrupting kernel execution', 'error');
      return false;
    }
  }, []);

  const restartKernel = useCallback(async () => {
    const manager = kernelManagerRef.current?.manager;
    const { KernelMode, KernelLanguage, KernelEvents } = kernelManagerRef.current || {};
    const kernelId = currentKernelIdRef.current;

    if (!manager || !KernelMode || !KernelLanguage) {
      showToast('Kernel manager not initialized', 'error');
      return;
    }

    showToast('Restarting kernel...', 'loading');

    try {
      setKernelStatus('starting');

      // Destroy current kernel if it exists
      if (kernelId) {
        try {
          await manager.destroyKernel(kernelId);
        } catch (error) {
          console.warn('[Web Python Kernel] Error destroying old kernel:', error);
        }
      }

      // Create a new kernel
      const newKernelId = await manager.createKernel({
        mode: KernelMode.WORKER,
        lang: KernelLanguage.PYTHON,
        autoSyncFs: true,
      });

      console.log('[Web Python Kernel] Created new kernel:', newKernelId);

      // Store kernel ID and kernel instance
      currentKernelIdRef.current = newKernelId;
      const newKernel = manager.kernels?.[newKernelId] || manager.getKernel?.(newKernelId);
      currentKernelRef.current = newKernel;

      // Re-setup event listeners
      manager.onKernelEvent(newKernelId, KernelEvents.KERNEL_BUSY, () => {
        setKernelStatus('busy');
      });

      manager.onKernelEvent(newKernelId, KernelEvents.KERNEL_IDLE, () => {
        setKernelStatus('idle');
      });

      // Update state
      const newKernelInfo = { kernelId: newKernelId, id: newKernelId };
      setKernelInfo(newKernelInfo);
      setKernelStatus('idle');
      setIsReady(true);

      // Initialize the executeCode function
      initializeExecuteCode(manager, newKernelInfo);

      // Clear any running cell states after successful restart
      if (clearRunningState) {
        clearRunningState();
        console.log('[Web Python Kernel] Cleared running cell states after restart');
      }

      showToast('Kernel restarted successfully', 'success');

    } catch (error) {
      console.error('Failed to restart kernel:', error);
      setKernelStatus('error');
      setIsReady(false);
      showToast(`Failed to restart kernel: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [initializeExecuteCode, clearRunningState]);

  const resetKernelState = useCallback(async () => {
    if (!isReady) {
      // If kernel isn't ready, perform a full restart
      console.warn('Kernel not ready, performing full restart instead of reset.');
      await restartKernel();
      return;
    }

    showToast('Resetting kernel state...', 'loading');
    try {
      setKernelStatus('busy');

      const resetCode = createKernelResetCode();

      // Use our executeCode function from ref to run the reset command
      const currentExecuteCode = executeCodeRef.current;
      if (currentExecuteCode) {
        await currentExecuteCode(resetCode, {
          onOutput: (output: any) => {
            console.log('[Web Python Kernel Reset]', output);
          },
          onStatus: (status: any) => {
            console.log('[Web Python Kernel Reset] Status:', status);
          }
        });
      }

      // Update status
      setKernelStatus('idle');

      showToast('Kernel state reset successfully', 'success');
    } catch (error) {
      console.error('Failed to reset kernel state:', error);
      setKernelStatus('error');
      showToast('Failed to reset kernel state', 'error');
    }
  }, [isReady, restartKernel]);

  // Mount native filesystem directory using web-python-kernel's built-in mountFS
  const mountDirectory = useCallback(async (mountPoint: string, dirHandle: FileSystemDirectoryHandle) => {
    const kernel = currentKernelRef.current;
    const manager = kernelManagerRef.current?.manager;
    const kernelId = currentKernelIdRef.current;

    if (!kernel || !dirHandle) {
      console.error('[Web Python Kernel] No kernel or directory handle available');
      console.log('[Web Python Kernel] Debug - kernel:', !!kernel, 'dirHandle:', !!dirHandle);
      showToast('Cannot mount directory: kernel not ready', 'error');
      return false;
    }

    try {
      console.log(`[Web Python Kernel] Mounting directory to ${mountPoint}...`);
      console.log(`[Web Python Kernel] Kernel type:`, typeof kernel);
      console.log(`[Web Python Kernel] Has kernel.kernel?:`, !!kernel.kernel);
      console.log(`[Web Python Kernel] Has kernel.mountFS?:`, !!kernel.mountFS);
      console.log(`[Web Python Kernel] Manager:`, !!manager);

      showToast(`Mounting directory to ${mountPoint}...`, 'loading');

      // Use web-python-kernel's built-in mountFS API
      // Try different access patterns
      let nativefs;
      if (kernel.kernel && typeof kernel.kernel.mountFS === 'function') {
        nativefs = await kernel.kernel.mountFS(mountPoint, dirHandle, 'readwrite');
      } else if (typeof kernel.mountFS === 'function') {
        nativefs = await kernel.mountFS(mountPoint, dirHandle, 'readwrite');
      } else if (manager && typeof manager.mountFS === 'function') {
        nativefs = await manager.mountFS(kernelId, mountPoint, dirHandle, 'readwrite');
      } else {
        throw new Error('mountFS function not found on kernel or manager');
      }

      console.log(`[Web Python Kernel] Successfully mounted directory to ${mountPoint}`);

      // Track the mounted path for auto-sync
      mountedPathsRef.current.add(mountPoint);

      // Verify the mount by listing files
      if (executeCode) {
        await executeCode(`
import os
if os.path.exists("${mountPoint}"):
    files = os.listdir("${mountPoint}")
    print(f"Mounted directory contains {len(files)} items")
    if files:
        print(f"Sample files: {files[:5]}")
else:
    print("Warning: Mount point does not exist")
`);
      }

      showToast(`Successfully mounted directory to ${mountPoint}`, 'success');
      return true;
    } catch (error) {
      console.error('[Web Python Kernel] Error mounting directory:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      showToast(`Failed to mount directory: ${errorMsg}`, 'error');
      return false;
    }
  }, [executeCode]);

  // Sync filesystem from Python VFS to native browser filesystem
  const syncFileSystem = useCallback(async (mountPath: string) => {
    const kernel = currentKernelRef.current;

    if (!kernel) {
      console.error('[Web Python Kernel] No kernel available for filesystem sync');
      return { success: false, error: 'No kernel available' };
    }

    try {
      console.log(`[Web Python Kernel] Syncing filesystem at ${mountPath}...`);

      // Try to access syncFileSystem on the kernel object (web-python-kernel 0.1.8+)
      // The actual kernel instance is in kernel.kernel
      const actualKernel = kernel.kernel || kernel;

      if (typeof actualKernel.syncFileSystem === 'function') {
        console.log(`[Web Python Kernel] Calling syncFileSystem for ${mountPath}...`);
        const result = await actualKernel.syncFileSystem(mountPath);
        console.log(`[Web Python Kernel] FileSystem synced successfully:`, result);
        return result || { success: true };
      }

      console.warn('[Web Python Kernel] syncFileSystem not available, filesystem should auto-sync');
      return { success: false, error: 'syncFileSystem not available' };
    } catch (error) {
      console.error('[Web Python Kernel] Error syncing filesystem:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }, []);

  return {
    isReady,
    kernelStatus,
    kernelInfo,
    executeCode,
    restartKernel,
    resetKernelState,
    initializeExecuteCode,
    addKernelLogEntry,
    kernelExecutionLog,
    interruptKernel,
    destroyCurrentKernel,
    mountDirectory,
    syncFileSystem
  };
};
