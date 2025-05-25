/**
 * Kernel management utilities
 */

import { KernelInfo, KernelExecutionLog, ExecuteCodeCallbacks } from './agentLabTypes';

/**
 * Creates an executeCode function for a given Deno service and kernel
 */
export const createExecuteCodeFunction = (
  deno: any,
  kernelInfo: KernelInfo,
  setKernelStatus: (status: 'idle' | 'busy' | 'starting' | 'error') => void,
  addKernelLogEntry: (entry: Omit<KernelExecutionLog, 'timestamp'>) => void
) => {
  return async function executeCode(
    code: string,
    callbacks?: ExecuteCodeCallbacks,
    timeout: number = 600000
  ) {
    const { onOutput, onStatus, cellId } = callbacks || {};
    
    // Log for debugging
    console.log(`[Deno Executor] Executing code for cell: ${cellId || 'unknown'}`);
    
    // Check for empty or whitespace-only code
    if (!code || code.trim() === '') {
      console.log(`[Deno Executor] Empty code detected for cell: ${cellId || 'unknown'}, skipping execution`);
      
      // Log the empty execution
      addKernelLogEntry({ type: 'input', content: code || '', cellId });
      addKernelLogEntry({ type: 'status', content: 'Completed (empty cell)', cellId });
      
      // Notify completion immediately
      onStatus?.('Completed');
      
      // Keep kernel status as idle since we didn't actually execute anything
      setKernelStatus('idle');
      
      return; // Early return for empty code
    }
    
    // Update kernel status
    setKernelStatus('busy');
    
    // Log input to kernel log
    addKernelLogEntry({ type: 'input', content: code, cellId });
    
    // Notify that execution has started
    onStatus?.('Executing code...');
    
    // Timeout handling with a simple flag
    let isTimedOut = false;
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      console.warn(`[Deno Executor] Execution timeout after ${timeout/1000}s`);
      
      // Since we can't abort, we'll just notify about the timeout
      onOutput?.({
        type: 'stderr',
        content: `Execution timeout after ${timeout/1000}s. The operation might still be running in the background.`,
        short_content: `Execution timeout after ${timeout/1000}s. The operation might still be running in the background.`
      });
      
      setKernelStatus('error');
      onStatus?.('Error');
      addKernelLogEntry({ 
        type: 'error', 
        content: `Execution timeout after ${timeout/1000}s`, 
        cellId 
      });
    }, timeout);
    
    // Execution states for tracking status
    let hasError = false;
    let executionStarted = false;
    let executionCompleted = false;
    
    try {
      console.log(`[Deno Executor] Starting execution, kernelId: ${kernelInfo.kernelId || kernelInfo.id}`);
      // Use the correct API call format - the Deno streamExecution expects an object with kernelId and code
      const streamGenerator = await deno.streamExecution({
        kernelId: kernelInfo.kernelId || kernelInfo.id,
        code: code
      });
      
      // Process the stream
      for await (const output of streamGenerator) {
        // Break if timeout occurred
        if (isTimedOut) break;
        
        // Mark execution as started with first output
        if (!executionStarted) {
          executionStarted = true;
          onStatus?.('Running...');
          addKernelLogEntry({ type: 'status', content: 'Running', cellId });
        }
        
        // Handle completion message
        if (output.type === 'complete') {
          executionCompleted = true;
          setKernelStatus('idle');
          onStatus?.('Completed');
          addKernelLogEntry({ type: 'status', content: 'Completed', cellId });
          continue;
        }
        
        // Handle errors
        if (output.type === 'error') {
          hasError = true;
          const errorData = output.data || {};
          const errorText = errorData.traceback ? 
            errorData.traceback.join('\n') :
            `${errorData.ename || 'Error'}: ${errorData.evalue || 'Unknown error'}`;
          
          addKernelLogEntry({ type: 'error', content: errorText, cellId });
          onOutput?.({
            type: 'stderr', 
            content: errorText,
            short_content: errorText
          });
          
          setKernelStatus('error');
          onStatus?.('Error');
          continue;
        }
        
        // Process output based on type
        processKernelOutput(output, onOutput, addKernelLogEntry, cellId);
        
        if (output.type === 'stream' && output.data?.name === 'stderr') {
          hasError = true;
          onStatus?.('Error');
        }
      }
      
      // If we've completed the stream without explicit completion or error
      if (!isTimedOut && !executionCompleted && !hasError) {
        setKernelStatus('idle');
        onStatus?.('Completed');
        addKernelLogEntry({ type: 'status', content: 'Completed', cellId });
        console.log(`[Deno Executor] Execution completed for cell: ${cellId || 'unknown'}`);
      }

    } catch (error) {
      // Handle errors during stream creation or processing
      if (!isTimedOut) {
        console.error('[Deno Executor] Error executing code:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        addKernelLogEntry({ 
          type: 'error', 
          content: `Execution failed: ${errorMsg}`, 
          cellId 
        });
        
        onOutput?.({
          type: 'stderr',
          content: `Execution failed: ${errorMsg}`,
          short_content: `Execution failed: ${errorMsg}`
        });
        
        setKernelStatus('error');
        onStatus?.('Error');
        
        throw error;
      }
    } finally {
      // Clear the timeout if not already triggered
      if (!isTimedOut) {
        clearTimeout(timeoutId);
      }
    }
  };
};

/**
 * Processes kernel output based on output type
 */
const processKernelOutput = (
  output: any,
  onOutput?: (output: { type: string; content: string; short_content?: string; attrs?: any }) => void,
  addKernelLogEntry?: (entry: Omit<KernelExecutionLog, 'timestamp'>) => void,
  cellId?: string
) => {
  switch (output.type) {
    case 'stream':
      const streamData = output.data;
      const streamType = streamData.name; // 'stdout' or 'stderr'
      const content = streamData.text;
      if (!content) return;
      
      addKernelLogEntry?.({ 
        type: streamType === 'stderr' ? 'error' : 'output', 
        content: content, 
        cellId 
      });
      
      onOutput?.({
        type: streamType,
        content: content,
        short_content: content.length > 4096 ? 
          `${content.substring(0, 2000)}... [truncated] ...${content.substring(content.length - 2000)}` : 
          content
      });
      break;

    case 'execute_error':
      const errorData = output.data || {};
      const errorText = Array.isArray(errorData.traceback) 
        ? errorData.traceback.join('\n')
        : `${errorData.ename || 'Error'}: ${errorData.evalue || 'Unknown error'}`;
      
      addKernelLogEntry?.({ 
        type: 'error', 
        content: errorText, 
        cellId 
      });
      
      onOutput?.({
        type: 'stderr',
        content: errorText,
        short_content: errorText
      });
      break;
      
    case 'display_data':
    case 'update_display_data':
    case 'execute_result':
      const displayData = output.data || {};
      const { displayContent, displayOutputType } = extractDisplayContent(displayData);
      
      if (!displayContent) return;
      
      addKernelLogEntry?.({ 
        type: 'output', 
        content: displayContent,
        cellId 
      });
      
      onOutput?.({
        type: displayOutputType,
        content: displayContent,
        short_content: displayContent.length > 4096 ? 
          `${displayContent.substring(0, 2000)}... [truncated] ...${displayContent.substring(displayContent.length - 2000)}` : 
          displayContent,
        attrs: (displayData.metadata || {})
      });
      break;
      
    case 'clear_output':
      const clearData = output.data || {};
      addKernelLogEntry?.({ 
        type: 'status', 
        content: `Clear output (wait: ${clearData.wait ? 'true' : 'false'})`, 
        cellId 
      });
      break;
      
    case 'input_request':
      const inputData = output.data || {};
      const promptText = `[Input Requested]: ${inputData.prompt || ''}`;
      
      addKernelLogEntry?.({ 
        type: 'output', 
        content: promptText, 
        cellId 
      });
      
      onOutput?.({
        type: 'stderr',
        content: 'Input requests are not supported in this environment.',
        short_content: 'Input requests are not supported in this environment.'
      });
      break;
      
    default:
      const defaultContent = output.content || output.data || (output.bundle ? JSON.stringify(output.bundle) : null);
      if (!defaultContent) return;
      
      addKernelLogEntry?.({ 
        type: 'output', 
        content: typeof defaultContent === 'string' ? defaultContent : JSON.stringify(output),
        cellId 
      });
      
      onOutput?.({
        type: output.type || 'stdout',
        content: defaultContent,
        short_content: typeof defaultContent === 'string' && defaultContent.length > 4096 ? 
          `${defaultContent.substring(0, 2000)}... [truncated] ...${defaultContent.substring(defaultContent.length - 2000)}` : 
          defaultContent,
        attrs: output.attrs
      });
  }
};

/**
 * Extracts content from display data based on mime types
 */
const extractDisplayContent = (displayData: any): { displayContent: string; displayOutputType: string } => {
  let displayContent = '';
  let displayOutputType = 'stdout'; // Default output type
  
  if (displayData.data && typeof displayData.data === 'object') {
    // Handle structure where data is nested inside data
    const mimeData = displayData.data;
    if (mimeData['text/html']) {
      displayContent = mimeData['text/html'];
      displayOutputType = 'html';
    } else if (mimeData['image/png']) {
      displayContent = `data:image/png;base64,${mimeData['image/png']}`;
      displayOutputType = 'img';
    } else if (mimeData['image/jpeg']) {
      displayContent = `data:image/jpeg;base64,${mimeData['image/jpeg']}`;
      displayOutputType = 'img';
    } else if (mimeData['image/svg+xml']) {
      displayContent = mimeData['image/svg+xml'];
      displayOutputType = 'svg';
    } else if (mimeData['text/plain']) {
      displayContent = mimeData['text/plain'];
      displayOutputType = 'stdout';
    } else {
      displayContent = JSON.stringify(mimeData);
      displayOutputType = 'stdout';
    }
  } else {
    // Handle flat structure
    displayContent = JSON.stringify(displayData);
    displayOutputType = 'stdout';
  }
  
  return { displayContent, displayOutputType };
};

/**
 * Creates kernel reset code for clearing the kernel state
 */
export const createKernelResetCode = (): string => {
  return `
# Reset all variables in the global scope
import { globalThis } from 'npm:@types/node';
const keys = Object.keys(globalThis);
const builtins = ['globalThis', 'self', 'window', 'global', 'Array', 'Boolean', 'console', 'Date', 'Error', 'Function', 'JSON', 'Math', 'Number', 'Object', 'RegExp', 'String'];
for (const key of keys) {
  if (!builtins.includes(key) && typeof globalThis[key] !== 'function') {
    try {
      delete globalThis[key];
    } catch (e) {
      console.log(\`Could not delete \${key}\`);
    }
  }
}
console.log('Kernel state has been reset');
  `;
}; 