import React, { useState, useEffect, useRef } from 'react';
import { useThebe } from './ThebeProvider';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import { Editor } from '@monaco-editor/react';
import { processTextOutput, processAnsiInOutputElement, outputAreaStyles } from '../../utils/ansi-utils';
import { JupyterOutput } from '../JupyterOutput';
import { OutputItem } from '../../types/notebook';

// Type definitions for external modules
type MonacoEditorProps = {
  height?: string | number;
  language?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  onMount?: (editor: any) => void;
  options?: {
    minimap?: { enabled: boolean };
    scrollBeyondLastLine?: boolean;
    wordWrap?: 'on' | 'off';
    lineNumbers?: 'on' | 'off';
    renderWhitespace?: 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
    folding?: boolean;
    [key: string]: any;
  };
};

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
  initialOutputs?: Array<{ type: string; content: string; attrs?: any }>;
}

export const InteractiveCodeBlock: React.FC<InteractiveCodeBlockProps> = ({ 
  code, 
  language = 'python',
  defaultCollapsed = true,
  initialStatus = '',
  domContent = '',
  initialOutputs = []
}) => {
  const { executeCodeWithDOMOutput, status, isReady, connect } = useThebe();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<string>(initialStatus);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [codeValue, setCodeValue] = useState(code);
  const outputRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null); // External reference for parent components
  const monacoEditorInstance = useRef<any>(null); // Actual Monaco editor instance
  const [isKernelConnecting, setIsKernelConnecting] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const [outputs, setOutputs] = useState<OutputItem[]>(initialOutputs);
  // Track if we're using DOM output mode to prevent duplicates
  const hasFinalDomOutput = useRef<boolean>(false);

  // Create and add style tag on component mount
  useEffect(() => {
    // Create a style element for our output styles
    const styleTag = document.createElement('style');
    styleTag.textContent = outputAreaStyles;
    document.head.appendChild(styleTag);
    styleRef.current = styleTag;
    
    // Cleanup on unmount
    return () => {
      if (styleRef.current && document.head.contains(styleRef.current)) {
        document.head.removeChild(styleRef.current);
      }
    };
  }, []);

  // Update status when initialStatus changes
  useEffect(() => {
    if (initialStatus) {
      setExecutionStatus(initialStatus);
    }
  }, [initialStatus]);

  // Update code value when code prop changes, but only if we're not in edit mode
  useEffect(() => {
    if (!isEditing) {
      setCodeValue(code);
    }
  }, [code, isEditing]);

  // Apply DOM content to output area when provided
  useEffect(() => {
    if (domContent && !isExecuting) {
      // Process text content for proper line breaks and ANSI codes
      if (domContent.startsWith('<pre>') || domContent.startsWith('<div>')) {
        // HTML content
        setOutputs([{
          type: 'html',
          content: domContent,
          attrs: {
            className: 'output-area'
          }
        }]);
      } else {
        // Plain text content - process for ANSI codes and line breaks
        const processedContent = processTextOutput(domContent);
        setOutputs([{
          type: 'html',
          content: processedContent,
          attrs: {
            className: 'output-area'
          }
        }]);
      }
      
      // If we have DOM content and no status, set status to completed
      if (!executionStatus || executionStatus === '') {
        setExecutionStatus('Completed');
      }
    }
  }, [domContent, isExecuting, executionStatus]);

  // Initialize outputs from initialOutputs if provided
  useEffect(() => {
    if (initialOutputs.length > 0 && outputs.length === 0) {
      setOutputs(initialOutputs);
    }
  }, [initialOutputs, outputs.length]);

  // Process any plain text outputs to format them correctly
  useEffect(() => {
    if (outputRef.current && !isExecuting) {
      processAnsiInOutputElement(outputRef.current);
    }
  }, [executionStatus, isExecuting]);
  
  // Function to handle editor mounting
  const handleEditorDidMount = (editor: any) => {
    monacoEditorInstance.current = editor; // Store the Monaco editor instance
    // Set initial value to ensure sync
    editor.setValue(codeValue);
  };

  // Function to handle editor changes
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCodeValue(value);
    }
  };

  // Get first line of code for preview
  const firstLine = codeValue.split('\n')[0].trim();
  const previewText = firstLine.startsWith('#') ? 
    firstLine.substring(2) : // Remove '# ' from comment
    'Executable Code Block';

  // Get the current code from the editor or state
  const getCurrentCode = () => {
    if (isEditing && monacoEditorInstance.current) {
      try {
        return monacoEditorInstance.current.getValue();
      } catch (e) {
        console.error('Error getting code from editor:', e);
        return codeValue;
      }
    }
    return codeValue;
  };

  const handleRunCode = async () => {
    if (isExecuting) return;
    
    // Always get the latest code using the getCurrentCode helper
    let codeToExecute = getCurrentCode();
    
    // Ensure state is in sync
    if (codeToExecute !== codeValue) {
      setCodeValue(codeToExecute);
    }
    
    setIsExecuting(true);
    setExecutionStatus('Running...');
    setOutputs([]); // Clear previous outputs
    
    // Reset DOM output flag
    hasFinalDomOutput.current = false;
    
    // Track if we received any outputs incrementally
    let hasIncrementalOutputs = false;
    
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
      
      // Temporary container to capture output
      const tempContainer = document.createElement('div');
      
      // Now execute the code
      await executeCodeWithDOMOutput(codeToExecute, tempContainer, {
        onStatus: setExecutionStatus,
        onOutput: (output: OutputItem) => {
          // Mark that we've received incremental outputs
          hasIncrementalOutputs = true;
          // Add all incremental outputs - we won't replace them later
          setOutputs(prev => [...prev, output]);
        }
      });
      
      // If we received HTML from the container and it's not empty
      // AND we didn't receive any incremental outputs, use the container content
      if (tempContainer.innerHTML && tempContainer.innerHTML.trim() !== '' && !hasIncrementalOutputs) {
        // Check if the HTML contains non-text content (like widgets, plots, etc.)
        const hasRichContent = 
          tempContainer.querySelector('img, svg, canvas, iframe') !== null ||
          tempContainer.innerHTML.includes('<div class="') || 
          tempContainer.innerHTML.includes('<table');
        
        if (hasRichContent) {
          // Add the final HTML content as an additional output
          setOutputs(prev => [...prev, {
            type: 'html',
            content: tempContainer.innerHTML,
            attrs: {
              // Mark this as special but don't set isRenderedDOM to true
              // so it doesn't replace all other outputs
              isFinalOutput: true
            }
          }]);
        }
      }
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionStatus('Error');
      
      // Add error output
      setOutputs(prev => [...prev, {
        type: 'stderr',
        content: error instanceof Error ? error.message : 'Error executing code. Please try again.'
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      // Switching from edit to view mode
      // Make sure to get the latest value from the editor
      const latestCode = getCurrentCode();
      setCodeValue(latestCode);
      setIsEditing(false);
    } else {
      // Switching from view to edit mode
      setIsCollapsed(false); // Make sure code is visible when editing
      setIsEditing(true);
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

  // Add a method to get the current code that can be called by parent components
  React.useImperativeHandle(
    editorRef,
    () => ({
      getCurrentCode
    }),
    [isEditing, codeValue]
  );

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm">
      {/* Header with preview and controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div 
          className="flex items-center space-x-2 cursor-pointer"
          onClick={() => !isEditing && setIsCollapsed(!isCollapsed)}
        >
          <span className={`transform transition-transform ${isEditing || !isCollapsed ? 'rotate-90' : ''}`}>
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
          
          {/* Edit/Done Button */}
          <button
            className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-200 ${
              isEditing 
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
            onClick={handleToggleEdit}
            title={isEditing ? "Done editing" : "Edit code"}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
          
          {/* Run Button */}
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
      
      {/* Code block - showing either syntax highlighted view or editor */}
      <div className={`transition-all duration-300 ${isCollapsed && !isEditing ? 'max-h-0 overflow-hidden' : 'max-h-[500px] overflow-auto'}`}>
        {isEditing ? (
          // Monaco Editor for editing
          <div className="h-[300px] w-full overflow-hidden">
            <Editor
              height="100%"
              language={language}
              value={codeValue}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                folding: true,
                fontSize: 13,
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                lineHeight: 1.5,
                padding: { top: 8, bottom: 8 }
              } as MonacoEditorProps['options']}
              className="w-full"
            />
          </div>
        ) : (
          // Syntax Highlighted view
          <SyntaxHighlighter 
            language={language} 
            style={oneLight}
            customStyle={{ margin: 0, padding: '1rem' }}
            showLineNumbers={true}
          >
            {codeValue}
          </SyntaxHighlighter>
        )}
      </div>
      
      {/* Output area - now using JupyterOutput component */}
      <div className="border-t border-gray-200">
        {outputs.length > 0 ? (
          <JupyterOutput outputs={outputs} className="p-2" />
        ) : (
          <div ref={outputRef} className="output-area p-4 overflow-x-auto"></div>
        )}
      </div>
    </div>
  );
}; 