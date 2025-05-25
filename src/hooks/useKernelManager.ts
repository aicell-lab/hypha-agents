/**
 * Hook for managing kernel state and operations
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { KernelManager, KernelInfo, KernelExecutionLog, ExecuteCodeCallbacks } from '../utils/agentLabTypes';
import { createExecuteCodeFunction, createKernelResetCode } from '../utils/kernelUtils';
import { showToast } from '../utils/notebookUtils';

interface UseKernelManagerProps {
  server: any;
  setupService: () => Promise<void>;
}

export const useKernelManager = ({ server, setupService }: UseKernelManagerProps): KernelManager => {
  const [isReady, setIsReady] = useState(false);
  const [kernelStatus, setKernelStatus] = useState<'idle' | 'busy' | 'starting' | 'error'>('starting');
  const [executeCode, setExecuteCode] = useState<((code: string, callbacks?: ExecuteCodeCallbacks, timeout?: number) => Promise<void>) | null>(null);
  const [kernelInfo, setKernelInfo] = useState<KernelInfo>({});
  const [kernelExecutionLog, setKernelExecutionLog] = useState<KernelExecutionLog[]>([]);
  const [isKernelStuck, setIsKernelStuck] = useState(false);
  
  // Add ref to store executeCode function to avoid circular dependencies
  const executeCodeRef = useRef<any>(null);

  // Function to update kernel log
  const addKernelLogEntry = useCallback((entryData: Omit<KernelExecutionLog, 'timestamp'>) => {
    const newEntry = {
      ...entryData,
      timestamp: Date.now(),
    };
    setKernelExecutionLog(prevLog => [...prevLog, newEntry]);
  }, []);

  // Function to initialize the executeCode function
  const initializeExecuteCode = useCallback((deno: any, kernelInfo: KernelInfo) => {
    if (!deno || !kernelInfo) return;
    
    const executeCodeFn = createExecuteCodeFunction(deno, kernelInfo, setKernelStatus, addKernelLogEntry);
    
    setExecuteCode(() => executeCodeFn);
    executeCodeRef.current = executeCodeFn;
    
    // Re-initialize services
    setupService();
  }, [addKernelLogEntry, setKernelStatus, setupService]);

  // Kernel initialization
  useEffect(() => {
    async function initializeKernel() {
      if (!server) return;
      
      const initTimeout = setTimeout(() => {
        console.error('[Deno Kernel] Initialization timeout after 30 seconds');
        setKernelStatus('error');
        setIsReady(false);
        showToast('Kernel initialization timed out. Please try restarting.', 'error');
      }, 180000); // 60 second timeout
      
      try {
        setKernelStatus('starting');
        console.log('[Deno Kernel] Initializing Deno kernel...');
        
        // Get the Deno service with timeout
        const deno = await Promise.race([
          server.getService('hypha-agents/deno-app-engine', { mode: 'random' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Service connection timeout')), 15000)
          )
        ]);
        
        console.log('[Deno Kernel] Got Deno service, creating kernel...');
        
        // Create a new kernel with timeout
        const newKernelInfo = await Promise.race([
          deno.createKernel({}),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Kernel creation timeout')), 15000)
          )
        ]);

        console.log('[Deno Kernel] Created kernel:', newKernelInfo);
        
        // Clear the timeout since we succeeded
        clearTimeout(initTimeout);
        
        // Update state
        setKernelInfo(newKernelInfo);
        setKernelStatus('idle');
        setIsReady(true);
        
        // Initialize the executeCode function
        initializeExecuteCode(deno, newKernelInfo);
        
        console.log('[Deno Kernel] Kernel initialization completed successfully');
      } catch (error) {
        clearTimeout(initTimeout);
        console.error('[Deno Kernel] Initialization error:', error);
        setKernelStatus('error');
        setIsReady(false);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('timeout')) {
          showToast('Kernel initialization timed out. Please check your connection and try restarting.', 'error');
        } else {
          showToast(`Kernel initialization failed: ${errorMessage}`, 'error');
        }
      }
    }

    initializeKernel();
  }, [server, initializeExecuteCode, setupService]);

  // Monitor kernel status for stuck states
  useEffect(() => {
    let stuckTimer: NodeJS.Timeout;
    
    if (kernelStatus === 'starting') {
      // Set a timer to detect if kernel is stuck in starting state
      stuckTimer = setTimeout(() => {
        console.warn('[AgentLab] Kernel appears to be stuck in starting state');
        setIsKernelStuck(true);
        showToast('Kernel initialization is taking longer than expected. You may need to restart.', 'warning');
      }, 180000); // 45 seconds
    } else {
      // Reset stuck state when kernel status changes
      setIsKernelStuck(false);
    }
    
    return () => {
      if (stuckTimer) {
        clearTimeout(stuckTimer);
      }
    };
  }, [kernelStatus]);

  const restartKernel = useCallback(async () => {
    if (!server) return;
    showToast('Restarting kernel...', 'loading');
    
    try {
      setKernelStatus('starting');

      // Get the Deno interpreter service and create a new kernel
      const deno = await server.getService('hypha-agents/deno-app-engine');
      
      // First attempt to close the existing kernel if we have one
      if (kernelInfo.kernelId || kernelInfo.id) {
        try {
          // Use destroyKernel instead of closeKernel to match the service API
          await deno.destroyKernel({ kernelId: kernelInfo.kernelId || kernelInfo.id });
          console.log('[Deno Kernel] Destroyed existing kernel:', kernelInfo.kernelId || kernelInfo.id);
        } catch (closeError) {
          console.warn('[Deno Kernel] Error destroying existing kernel:', closeError);
          // Continue with restart even if destroy fails
        }
      }
      
      // Create a new kernel with empty options object
      const newKernelInfo = await deno.createKernel({});
      console.log('[Deno Kernel] Created new kernel:', newKernelInfo);

      // Update our state with the new kernel info
      setKernelInfo(newKernelInfo);
      setKernelStatus('idle');
      setIsReady(true);
      
      // Re-initialize executeCode function with the new kernel
      initializeExecuteCode(deno, newKernelInfo);
      
    } catch (error) {
      console.error('Failed to restart kernel:', error);
      setKernelStatus('error');
      setIsReady(false);
      showToast('Failed to restart kernel', 'error');
    }
  }, [server, initializeExecuteCode, kernelInfo]);

  const resetKernelState = useCallback(async () => {
    if (!isReady || !server) {
      // If kernel isn't ready, perform a full restart
      console.warn('Kernel not ready, performing full restart instead of reset.');
      await restartKernel();
      return;
    }

    showToast('Resetting kernel state...', 'loading');
    try {
      // Get Deno service
      const deno = await server.getService('hypha-agents/deno-app-engine');
      
      // Execute a simple reset command to clear variables
      if (kernelInfo.kernelId || kernelInfo.id) {
        setKernelStatus('busy');
        
        const resetCode = createKernelResetCode();
        
        // Use our executeCode function from ref to run the reset command
        const currentExecuteCode = executeCodeRef.current;
        if (currentExecuteCode) {
          await currentExecuteCode(resetCode, {
            onOutput: (output: any) => {
              console.log('[Deno Kernel Reset]', output);
            },
            onStatus: (status: any) => {
              console.log('[Deno Kernel Reset] Status:', status);
            }
          });
        }
      }

      // Update status
      setKernelStatus('idle');
      
      showToast('Kernel state reset successfully', 'success');
    } catch (error) {
      console.error('Failed to reset kernel state:', error);
      setKernelStatus('error');
      showToast('Failed to reset kernel state', 'error');
    }
  }, [isReady, server, restartKernel, kernelInfo]);

  return {
    isReady,
    kernelStatus,
    kernelInfo,
    executeCode,
    restartKernel,
    resetKernelState,
    initializeExecuteCode,
    addKernelLogEntry,
    kernelExecutionLog
  };
}; 