import React, { useState, useEffect } from 'react';
import { useThebe } from './ThebeProvider';
import OutputDisplay from './OutputDisplay';
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

interface CodeBlockProps {
  code: string;
  language?: string;
  defaultCollapsed?: boolean;
  initialOutputs?: Array<{ type: string; content: string; attrs?: any }>;
  initialStatus?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  code, 
  language = 'python',
  defaultCollapsed = true,
  initialOutputs = [],
  initialStatus = ''
}) => {
  const { executeCode, status, isReady, connect } = useThebe();
  const [outputs, setOutputs] = useState<Array<{ type: string; content: string; attrs?: any }>>(initialOutputs);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<string>(initialStatus);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Update outputs when initialOutputs changes
  useEffect(() => {
    if (initialOutputs.length > 0) {
      setOutputs(initialOutputs);
    }
  }, [initialOutputs]);

  // Update status when initialStatus changes
  useEffect(() => {
    if (initialStatus) {
      setExecutionStatus(initialStatus);
    }
  }, [initialStatus]);

  // Get first line of code for preview
  const firstLine = code.split('\n')[0].trim();
  const previewText = firstLine.startsWith('#') ? 
    firstLine.substring(2) : // Remove '# ' from comment
    firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;

  const handleExecute = async () => {
    try {
      setIsExecuting(true);
      setOutputs([]);
      setExecutionStatus('Starting...');

      // If not ready, try to connect first
      if (!isReady) {
        setExecutionStatus('Connecting to kernel...');
        await connect();
      }

      // Execute code with real-time output and status handling
      await executeCode(code, {
        onOutput: (output) => {
          console.log('Received new output:', output);
          // don't show the output if it's just a newline
          if (output.content.trim() !== '') {
            setOutputs(prev => [...prev, output]);
          }
        },
        onStatus: (status) => {
          console.log('Execution status changed:', status);
          setExecutionStatus(status);
        }
      });
    } catch (error) {
      console.error('Error executing code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error executing code. Please try again.';
      setOutputs(prev => [...prev, { type: 'stderr', content: errorMessage }]);
      setExecutionStatus('Error');
    } finally {
      // Always ensure we clear the executing state
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with collapse/expand and run buttons */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex-shrink-0 text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded transition-colors"
            title={isCollapsed ? "Expand code" : "Collapse code"}
          >
            <svg
              className={`w-4 h-4 transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          {isCollapsed && (
            <span className="text-sm text-gray-600 truncate">{previewText}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {executionStatus && (
            <span className={`text-xs ${
              executionStatus.includes('Error') ? 'text-red-600' :
              executionStatus === 'Completed' ? 'text-green-600' :
              'text-gray-600'
            }`}>
              {executionStatus}
            </span>
          )}
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className={`px-3 py-1 rounded text-xs font-medium text-white ${
              !isExecuting
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isExecuting ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
      
      {/* Code content - collapsible */}
      <div className={`transition-all duration-200 overflow-hidden ${isCollapsed ? 'h-0' : ''}`}>
        <div className="overflow-x-auto bg-gray-50/50">
          <SyntaxHighlighter
            language={language}
            style={oneLight}
            customStyle={{
              margin: 0,
              paddingTop: '1rem',
              paddingBottom: '1rem',
              paddingLeft: '1rem',
              paddingRight: '1rem',
              background: 'transparent',
              fontSize: '0.875rem',
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
      
      {/* Outputs */}
      {(outputs.length > 0 || initialOutputs.length > 0) && (
        <div className="bg-gray-50 p-4 border-t border-gray-200">
          <OutputDisplay outputs={outputs.length > 0 ? outputs : initialOutputs} />
        </div>
      )}
    </div>
  );
}; 