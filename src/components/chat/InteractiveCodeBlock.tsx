import React, { useState, useEffect, useRef } from 'react';
import { useThebe } from './ThebeProvider';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import Editor from '@monaco-editor/react';
import Convert from 'ansi-to-html';

// Register languages
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);

// Create ANSI converter instance
const ansiConverter = new Convert({
  colors: {
    0: '#000000',
    1: '#e74c3c', // red
    2: '#2ecc71', // green
    3: '#f1c40f', // yellow
    4: '#3498db', // blue
    5: '#9b59b6', // magenta
    6: '#1abc9c', // cyan
    7: '#ecf0f1', // light gray
    8: '#95a5a6', // dark gray
    9: '#e74c3c', // bright red
    10: '#2ecc71', // bright green
    11: '#f1c40f', // bright yellow
    12: '#3498db', // bright blue
    13: '#9b59b6', // bright magenta
    14: '#1abc9c', // bright cyan
    15: '#ecf0f1'  // white
  },
  newline: false // We'll handle newlines separately
});

// Process text content with ANSI color codes
const processTextOutput = (text: string): string => {
  // Convert ANSI codes to HTML
  const htmlWithAnsi = ansiConverter.toHtml(text);
  
  // Handle line breaks - keep text in a single line unless there's a newline character
  // Filter out empty lines
  const lines = htmlWithAnsi.split('\n').filter(line => line.trim() !== '');
  
  // If it's just a single line, return as-is
  if (lines.length === 1) {
    return `<pre class="output-line">${lines[0]}</pre>`;
  }
  
  // Otherwise, create a proper multi-line output
  return `<pre class="output-multiline">${lines.join('<br>')}</pre>`;
};

// Common output styles as a CSS string (for style tag)
const outputAreaStyles = `
  .output-area {
    overflow-x: auto;
  }
  
  .output-area pre, 
  .output-area .stream-output,
  .output-area .error-output,
  .output-area .output-line,
  .output-area .output-multiline {
    font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.4;
    padding: 0.5rem;
    margin: 0;
    background-color: #f8f9fa;
    border-radius: 4px;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  
  .output-area .error-output {
    color: #e74c3c;
  }
`;

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
  // This prevents overriding user changes when the parent re-renders
  useEffect(() => {
    if (!isEditing) {
      setCodeValue(code);
    }
  }, [code, isEditing]);

  // Ensure Plotly is loaded if needed
  useEffect(() => {
    // Check if code contains Plotly-related imports or functions
    const hasPlotly = /plotly|px\.|fig\.show\(\)|fig = px\.|import plotly|display\(fig\)/i.test(codeValue);
    
    if (hasPlotly && typeof window !== 'undefined' && !window.Plotly) {
      // Preload Plotly library
      console.log('Preloading Plotly for code block');
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-3.0.1.min.js';
      script.async = true;
      document.head.appendChild(script);
      
      return () => {
        // Clean up if component unmounts before script loads
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, [codeValue]);

  // Apply DOM content to output area when provided
  useEffect(() => {
    if (outputRef.current && domContent && !isExecuting) {
      // Process text content for proper line breaks and ANSI codes
      if (domContent.startsWith('<pre>') || domContent.startsWith('<div>')) {
        // HTML content - apply directly
        outputRef.current.innerHTML = domContent;
      } else {
        // Plain text content - process for ANSI codes and line breaks
        const processedContent = processTextOutput(domContent);
        outputRef.current.innerHTML = processedContent;
      }
      
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
  
  // Function to process all text in the output element for ANSI codes
  const processAnsiInOutputElement = (container: HTMLElement) => {
    // Find all text nodes that might contain ANSI codes
    const textNodes = Array.from(container.querySelectorAll('*'))
      .filter(el => {
        // Get elements that likely contain text with ANSI codes
        const tagName = el.tagName.toLowerCase();
        return (tagName === 'pre' || tagName === 'code' || tagName === 'div') &&
          !el.classList.contains('output-line') && 
          !el.classList.contains('output-multiline');
      });
    
    // Also check direct text children of the container
    if (container.childNodes.length > 0 && 
        container.childNodes[0].nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      if (text.includes('[0;') || text.includes('[1;')) {
        const processedContent = processTextOutput(text);
        container.innerHTML = processedContent;
        return; // We've replaced the entire container content
      }
    }
    
    // Process stream-output elements for ANSI codes
    const streamOutputs = container.querySelectorAll('.stream-output');
    streamOutputs.forEach(el => {
      // Process any ANSI codes inside stream outputs
      const text = el.textContent || '';
      if (text.trim() === '') {
        // If it's just empty or whitespace, hide this element
        (el as HTMLElement).style.display = 'none';
        return;
      }
      
      if (text.includes('[0;') || text.includes('[1;') || 
          text.includes('\u001b[') || text.includes('\\u001b[')) {
        try {
          // Convert ANSI to HTML
          const processedHTML = ansiConverter.toHtml(text);
          
          // Filter out empty lines
          const lines = processedHTML.split('\n').filter(line => line.trim() !== '');
          el.innerHTML = lines.join('<br>');
        } catch (error) {
          console.error('Error processing ANSI codes in stream output:', error);
        }
      } else {
        // For regular text without ANSI codes, still handle newlines
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 0) {
          el.textContent = lines.join('\n');
        } else {
          // Hide completely empty outputs
          (el as HTMLElement).style.display = 'none';
        }
      }
    });
    
    // Process each element that might contain ANSI codes
    textNodes.forEach(el => {
      // Skip stream-output elements (we handled them separately)
      if (el.classList.contains('stream-output')) return;
      
      const text = el.textContent || '';
      
      // Check if it contains ANSI escape sequences
      if (text.includes('[0;') || text.includes('[1;') || 
          text.includes('\u001b[') || text.includes('\\u001b[')) {
        try {
          // Process the text
          const processedHTML = processTextOutput(text);
          
          // Create a wrapper to hold the processed content
          const wrapper = document.createElement('div');
          wrapper.innerHTML = processedHTML;
          
          // Replace the original content with processed content
          if (wrapper.firstChild) {
            el.parentNode?.replaceChild(wrapper.firstChild, el);
          }
        } catch (error) {
          console.error('Error processing ANSI codes:', error);
        }
      }
    });
  };

  // Function to handle editor mounting
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Get first line of code for preview
  const firstLine = codeValue.split('\n')[0].trim();
  const previewText = firstLine.startsWith('#') ? 
    firstLine.substring(2) : // Remove '# ' from comment
    'executable code block';

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
              onChange={(value) => {
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
              }}
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