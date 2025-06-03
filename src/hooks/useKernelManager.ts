/**
 * Hook for managing kernel state and operations
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { KernelManager, KernelInfo, KernelExecutionLog, ExecuteCodeCallbacks } from '../utils/agentLabTypes';
import { createExecuteCodeFunction, createKernelResetCode } from '../utils/kernelUtils';
import { showToast } from '../utils/notebookUtils';

interface UseKernelManagerProps {
  server: any;
  clearRunningState?: () => void;
  onKernelReady?: (executeCode: (code: string, callbacks?: ExecuteCodeCallbacks, timeout?: number) => Promise<void>) => void;
}

export const useKernelManager = ({ server, clearRunningState, onKernelReady }: UseKernelManagerProps): KernelManager => {
  const [isReady, setIsReady] = useState(false);
  const [kernelStatus, setKernelStatus] = useState<'idle' | 'busy' | 'starting' | 'error'>('starting');
  const [executeCode, setExecuteCode] = useState<((code: string, callbacks?: ExecuteCodeCallbacks, timeout?: number) => Promise<void>) | null>(null);
  const [kernelInfo, setKernelInfo] = useState<KernelInfo>({});
  const [kernelExecutionLog, setKernelExecutionLog] = useState<KernelExecutionLog[]>([]);
  const [isKernelStuck, setIsKernelStuck] = useState(false);
  
  // Add ref to store executeCode function to avoid circular dependencies
  const executeCodeRef = useRef<any>(null);
  // Add ref to store the Deno service instance
  const denoServiceRef = useRef<any>(null);
  // Add ref for ping interval
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Add ref to prevent multiple initializations
  const isInitializingRef = useRef(false);
  // Add ref to store onKernelReady callback to prevent dependency issues
  const onKernelReadyRef = useRef(onKernelReady);

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

  // Function to ping kernel periodically
  const startKernelPing = useCallback((kernelInfoParam: KernelInfo) => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    const deno = denoServiceRef.current;
    const kernelId = kernelInfoParam.kernelId || kernelInfoParam.id;
    
    if (!deno || !kernelId) return;

    // Ping every 30 seconds to keep kernel alive
    pingIntervalRef.current = setInterval(async () => {
      try {
        const success = await deno.pingKernel({kernelId});
        if (!success) {
          console.warn('[Deno Kernel] Failed to ping kernel, it may have been destroyed');
          // Optionally set kernel status to error or try to reconnect
        }
      } catch (error) {
        console.error('[Deno Kernel] Error pinging kernel:', error);
      }
    }, 30000); // 30 seconds
  }, []); // No dependencies since we pass kernelInfo as parameter

  // Function to stop kernel ping
  const stopKernelPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Function to destroy current kernel
  const destroyCurrentKernel = useCallback(async () => {
    const deno = denoServiceRef.current;
    const kernelId = kernelInfo.kernelId || kernelInfo.id;
    
    if (!deno || !kernelId) return;

    try {
      console.log('[Deno Kernel] Destroying current kernel:', kernelId);
      await deno.destroyKernel({ kernelId });
      stopKernelPing();
    } catch (error) {
      console.warn('[Deno Kernel] Error destroying kernel:', error);
    }
  }, [kernelInfo, stopKernelPing]);

  // Function to interrupt kernel execution
  const interruptKernel = useCallback(async () => {
    const deno = denoServiceRef.current;
    const kernelId = kernelInfo.kernelId || kernelInfo.id;
    
    if (!deno || !kernelId) {
      showToast('No active kernel to interrupt', 'warning');
      return false;
    }

    try {
      showToast('Interrupting kernel execution...', 'loading');
      console.log('[Deno Kernel] Interrupting kernel:', kernelId);
      const result = await deno.interruptKernel({kernelId});
      
      if (result.success) {
        showToast('Kernel execution interrupted', 'success');
      } else {
        showToast('Failed to interrupt kernel execution', 'error');
      }
      
      return result.success;
    } catch (error) {
      console.error('[Deno Kernel] Error interrupting kernel:', error);
      showToast('Error interrupting kernel execution', 'error');
      return false;
    }
  }, [kernelInfo]);

  // Function to initialize the executeCode function
  const initializeExecuteCode = useCallback((deno: any, kernelInfo: KernelInfo) => {
    if (!deno || !kernelInfo) return;
    
    // Store deno service reference
    denoServiceRef.current = deno;
    
    const executeCodeFn = createExecuteCodeFunction(deno, kernelInfo, setKernelStatus, addKernelLogEntry);
    
    setExecuteCode(() => executeCodeFn);
    executeCodeRef.current = executeCodeFn;
    
    // Start ping interval
    startKernelPing(kernelInfo);
    
    // Re-initialize services (call setupService but don't include it in dependencies to avoid circular dependency)
    onKernelReadyRef.current?.((executeCodeFn));
  }, [addKernelLogEntry, setKernelStatus]); // Removed onKernelReadyRef from dependency array since refs are stable

  // Kernel initialization
  useEffect(() => {
    async function initializeKernel() {
      if (!server) return;
      
      // Prevent multiple concurrent initializations
      if (isInitializingRef.current) {
        console.log('[Deno Kernel] Initialization already in progress, skipping...');
        return;
      }
      
      // Mark as initializing
      isInitializingRef.current = true;
      
      const initTimeout = setTimeout(() => {
        console.error('[Deno Kernel] Initialization timeout after 30 seconds');
        setKernelStatus('error');
        setIsReady(false);
        showToast('Kernel initialization timed out. Please try restarting.', 'error');
        isInitializingRef.current = false; // Reset flag on timeout
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
        
        // Reset initialization flag
        isInitializingRef.current = false;
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
        
        // Reset initialization flag on error
        isInitializingRef.current = false;
      }
    }

    initializeKernel();
  }, [server, initializeExecuteCode]); // Removed onKernelReady from dependency array

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

  // Cleanup ping interval on unmount
  useEffect(() => {
    return () => {
      stopKernelPing();
    };
  }, [stopKernelPing]);

  const restartKernel = useCallback(async () => {
    const deno = denoServiceRef.current;
    const kernelId = kernelInfo.kernelId || kernelInfo.id;
    
    if (!deno || !kernelId) {
      showToast('No kernel service available for restart', 'error');
      return;
    }

    showToast('Restarting kernel...', 'loading');
    
    try {
      setKernelStatus('starting');
      stopKernelPing();

      // Use the new service restartKernel function
      const success = await deno.restartKernel({kernelId});
      
      if (success) {
        console.log(`[Deno Kernel] Kernel restarted successfully: ${kernelId}`);
        setKernelStatus('idle');
        setIsReady(true);
        
        // Clear any running cell states after successful restart
        if (clearRunningState) {
          clearRunningState();
          console.log('[Deno Kernel] Cleared running cell states after restart');
        }
        
        // Re-initialize executeCode function with the existing service and kernel info
        initializeExecuteCode(deno, kernelInfo);
        
        showToast('Kernel restarted successfully', 'success');
      } else {
        console.error('[Deno Kernel] Failed to restart kernel');
        setKernelStatus('error');
        setIsReady(false);
        showToast('Failed to restart kernel', 'error');
      }
      
    } catch (error) {
      console.error('Failed to restart kernel:', error);
      setKernelStatus('error');
      setIsReady(false);
      showToast(`Failed to restart kernel: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [kernelInfo, initializeExecuteCode, stopKernelPing, clearRunningState]);

  const resetKernelState = useCallback(async () => {
    if (!isReady || !server) {
      // If kernel isn't ready, perform a full restart
      console.warn('Kernel not ready, performing full restart instead of reset.');
      await restartKernel();
      return;
    }

    showToast('Resetting kernel state...', 'loading');
    try {
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
    kernelExecutionLog,
    interruptKernel,
    destroyCurrentKernel
  };
}; 