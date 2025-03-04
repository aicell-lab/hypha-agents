import React, { useState, useEffect, useRef } from 'react';
import { useThebe } from './ThebeProvider';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import { Editor } from '@monaco-editor/react';
import { executeScripts } from '../../utils/script-utils';
import { processTextOutput, processAnsiInOutputElement, outputAreaStyles } from '../../utils/ansi-utils';

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
  const [isEditing, setIsEditing] = useState(false);
  const [codeValue, setCodeValue] = useState(code);
  const outputRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null); // Reference to store the editor instance
  const [isKernelConnecting, setIsKernelConnecting] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);

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
    if (outputRef.current && domContent && !isExecuting) {
      // Process text content for proper line breaks and ANSI codes
      if (domContent.startsWith('<pre>') || domContent.startsWith('<div>')) {
        // HTML content - apply directly
        outputRef.current.innerHTML = domContent;
        // Execute any scripts in the content
        executeScripts(outputRef.current);
      } else {
        // Plain text content - process for ANSI codes and line breaks
        const processedContent = processTextOutput(domContent);
        outputRef.current.innerHTML = processedContent;
      }
      
      // If we have DOM content and no status, set status to completed
      if (!executionStatus || executionStatus === '') {
        setExecutionStatus('Completed');
      }
      
      // Process any text that might contain ANSI codes
      processAnsiInOutputElement(outputRef.current);
    }
  }, [domContent, isExecuting, executionStatus]);

  // Process any plain text outputs to format them correctly
  useEffect(() => {
    if (outputRef.current && !isExecuting) {
      processAnsiInOutputElement(outputRef.current);
    }
  }, [executionStatus, isExecuting]);
  
  // Function to handle editor mounting
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Get first line of code for preview
  const firstLine = codeValue.split('\n')[0].trim();
  const previewText = firstLine.startsWith('#') ? 
    firstLine.substring(2) : // Remove '# ' from comment
    'Executable Code Block';

  const handleRunCode = async () => {
    if (!outputRef.current || isExecuting) return;
    
    // Get the latest code directly from the editor if we're in edit mode
    let codeToExecute = codeValue;
    if (isEditing && editorRef.current) {
      codeToExecute = editorRef.current.getValue();
      // Also update our state to keep it in sync
      setCodeValue(codeToExecute);
    }
    
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
      await executeCodeWithDOMOutput(codeToExecute, outputRef.current, {
        onStatus: setExecutionStatus
      });
      
      // Process ANSI codes in the output after execution completes
      processAnsiInOutputElement(outputRef.current);
      
      // Execute any scripts in the output
      if (outputRef.current) {
        executeScripts(outputRef.current);
      }
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionStatus('Error');
      if (outputRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Error executing code. Please try again.';
        outputRef.current.innerHTML += `<pre class="error-output">Error: ${errorMessage}</pre>`;
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      // Switching from edit to view mode
      // Make sure to get the latest value from the editor
      if (editorRef.current) {
        const latestCode = editorRef.current.getValue();
        setCodeValue(latestCode);
      }
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
          <div className="h-[300px]">
            <Editor
              height="100%"
              language={language}
              value={codeValue}
              onChange={(value: string | undefined) => {
                if (value !== undefined) {
                  setCodeValue(value);
                }
              }}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                folding: true
              } as MonacoEditorProps['options']}
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
      
      {/* Output area with style for proper text rendering */}
      <div 
        ref={outputRef} 
        className="output-area border-t border-gray-200 p-4 min-h-[2rem] overflow-x-auto"
      ></div>
    </div>
  );
}; 