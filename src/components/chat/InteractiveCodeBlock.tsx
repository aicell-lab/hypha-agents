import React, { useState, useEffect, useRef } from 'react';
import { useThebe } from './ThebeProvider';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';

// Register languages
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);

interface InteractiveCodeBlockProps {
  code: string;
  language?: string;
  defaultCollapsed?: boolean;
  initialStatus?: string;
  domContent?: string;
}

export const InteractiveCodeBlock: React.FC<InteractiveCodeBlockProps> = ({ 
  code, 
  language = 'python',
  defaultCollapsed = true,
  initialStatus = '',
  domContent = ''
}) => {
  const { executeCodeWithDOMOutput, status, isReady, connect } = useThebe();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<string>(initialStatus);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const outputRef = useRef<HTMLDivElement>(null);
  const [isKernelConnecting, setIsKernelConnecting] = useState(false);

  // Update status when initialStatus changes
  useEffect(() => {
    if (initialStatus) {
      setExecutionStatus(initialStatus);
    }
  }, [initialStatus]);

  // Ensure Plotly is loaded if needed
  useEffect(() => {
    // Check if code contains Plotly-related imports or functions
    const hasPlotly = /plotly|px\.|fig\.show\(\)|fig = px\.|import plotly|display\(fig\)/i.test(code);
    
    if (hasPlotly && typeof window !== 'undefined' && !window.Plotly) {
      // Preload Plotly library
      console.log('Preloading Plotly for code block');
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-latest.min.js';
      script.async = true;
      document.head.appendChild(script);
      
      return () => {
        // Clean up if component unmounts before script loads
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, [code]);

  // Apply DOM content to output area when provided
  useEffect(() => {
    if (outputRef.current && domContent && !isExecuting) {
      // Only apply DOM content if we're not currently executing code
      outputRef.current.innerHTML = domContent;
      
      // Execute scripts in the DOM content
      const scripts = outputRef.current.querySelectorAll('script');
      scripts.forEach(oldScript => {
        if (!oldScript.parentNode) return;
        
        const newScript = document.createElement('script');
        // Copy all attributes
        Array.from(oldScript.attributes).forEach(attr => 
          newScript.setAttribute(attr.name, attr.value)
        );
        
        // If it has a src, just copy that
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          // Otherwise, copy the inline code
          newScript.textContent = oldScript.textContent;
        }
        
        // Replace the old script with the new one
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
      
      // If we have DOM content and no status, set status to completed
      if (!executionStatus || executionStatus === '') {
        setExecutionStatus('Completed');
      }
    }
  }, [domContent, isExecuting, executionStatus]);

  // Get first line of code for preview
  const firstLine = code.split('\n')[0].trim();
  const previewText = firstLine.startsWith('#') ? 
    firstLine.substring(2) : // Remove '# ' from comment
    firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;

  const handleRunCode = async () => {
    if (!outputRef.current || isExecuting) return;
    
    setIsExecuting(true);
    setExecutionStatus('Running...');
    outputRef.current.innerHTML = ''; // Clear previous output
    
    try {
      // If not ready, try to connect first
      if (!isReady) {
        setIsKernelConnecting(true);
        setExecutionStatus('Connecting to kernel...');
        try {
          await connect();
        } finally {
          setIsKernelConnecting(false);
        }
      }
      
      // Now execute the code
      await executeCodeWithDOMOutput(code, outputRef.current, {
        onStatus: setExecutionStatus
      });
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionStatus('Error');
      if (outputRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Error executing code. Please try again.';
        outputRef.current.innerHTML += `<pre class="error-output" style="color: red;">Error: ${errorMessage}</pre>`;
      }
    } finally {
      setIsExecuting(false);
    }
  };

  // Determine button state
  const isButtonDisabled = isExecuting || isKernelConnecting || (!isReady && !isKernelConnecting);
  const buttonLabel = isExecuting ? 'Running...' : 
                      isKernelConnecting ? 'Connecting...' : 
                      'Run';
  const buttonTooltip = isExecuting ? 'Code is currently executing' : 
                       isKernelConnecting ? 'Connecting to kernel...' :
                       !isReady ? 'Kernel is not ready yet' : 
                       'Run this code';

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm">
      {/* Header with preview and controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div 
          className="flex items-center space-x-2 cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
            ▶
          </span>
          <span className="font-mono text-sm text-gray-700">{previewText}</span>
        </div>
        <div className="flex items-center space-x-2">
          {executionStatus && (
            <span className={`text-xs px-2 py-1 rounded ${
              executionStatus === 'Completed' ? 'bg-green-100 text-green-800' :
              executionStatus === 'Error' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {executionStatus}
            </span>
          )}
          <button
            className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-200 ${
              isButtonDisabled
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            onClick={handleRunCode}
            disabled={isButtonDisabled}
            title={buttonTooltip}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
      
      {/* Code block */}
      <div className={`transition-all duration-300 ${isCollapsed ? 'max-h-0 overflow-hidden' : 'max-h-[500px] overflow-auto'}`}>
        <pre className="p-4 text-sm font-mono overflow-x-auto">
          <code>{code}</code>
        </pre>
      </div>
      
      {/* Output area */}
      <div 
        ref={outputRef} 
        className="output-area border-t border-gray-200 p-4 min-h-[2rem]"
      ></div>
    </div>
  );
}; 