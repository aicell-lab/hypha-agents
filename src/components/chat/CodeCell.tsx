import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import Convert from 'ansi-to-html';

const convert = new Convert({
  fg: '#000',
  bg: '#fff',
  newline: true,
  escapeXML: true,
  stream: false
});

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

interface CodeCellProps {
  code: string;
  language?: string;
  defaultCollapsed?: boolean;
  initialStatus?: string;
  domContent?: string;
  onExecute?: () => void;
  isExecuting?: boolean;
  executionCount?: number;
  blockRef?: React.RefObject<{ getCurrentCode: () => string }>;
  isActive?: boolean;
}

export const CodeCell: React.FC<CodeCellProps> = ({ 
  code, 
  language = 'python',
  defaultCollapsed = true,
  initialStatus = '',
  domContent = '',
  onExecute,
  isExecuting = false,
  executionCount,
  blockRef,
  isActive = false
}) => {
  const { executeCodeWithDOMOutput, status, isReady } = useThebe();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [codeValue, setCodeValue] = useState(code);
  const [output, setOutput] = useState<string>('');
  const outputRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const editorDivRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);
  const lineHeightPx = 19; // Approximate line height in pixels
  const minLines = 3; // Minimum number of lines to show
  const paddingHeight = 16; // 8px padding top + 8px padding bottom

  // Expose getCurrentCode method through ref
  React.useImperativeHandle(blockRef, () => ({
    getCurrentCode: () => editorRef.current?.getValue() || codeValue
  }), [codeValue]);

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

  // Update code value when code prop changes, but only if we're not in edit mode
  useEffect(() => {
    if (!isEditing) {
      setCodeValue(code);
    }
  }, [code, isEditing]);

  // Update editor height when content changes
  const updateEditorHeight = useCallback(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        const newHeight = Math.max(lineCount * lineHeightPx + paddingHeight, minLines * lineHeightPx + paddingHeight);
        setEditorHeight(newHeight);
      }
    }
  }, []);

  // Update height when content changes
  useEffect(() => {
    updateEditorHeight();
  }, [codeValue, updateEditorHeight]);

  // Handle code execution
  const handleExecute = useCallback(async () => {
    if (!isReady || isExecuting) return;
    
    // Get the current value from the editor
    const currentCode = editorRef.current?.getValue() || codeValue;
    
    if (onExecute) {
      onExecute();
    } else {
      // Fallback to local execution if no onExecute provided
      if (outputRef.current) {
        // Clear previous output
        outputRef.current.innerHTML = '';
        setOutput('');
        
        try {
          await executeCodeWithDOMOutput(currentCode, outputRef.current, {
            onOutput: (output) => {
              // For non-HTML outputs, create appropriate DOM elements
              if (output.type === 'stdout' || output.type === 'stderr') {
                const pre = document.createElement('pre');
                pre.className = output.type === 'stdout' 
                  ? 'text-gray-700 whitespace-pre-wrap'
                  : 'text-red-600 whitespace-pre-wrap';
                // Convert ANSI escape codes to HTML
                pre.innerHTML = convert.toHtml(output.content);
                outputRef.current?.appendChild(pre);
              } else if (output.type === 'img') {
                const img = document.createElement('img');
                img.src = output.content;
                img.className = 'max-w-full';
                img.alt = 'Output';
                outputRef.current?.appendChild(img);
              } else if (output.type === 'html') {
                // For HTML content, create a container and set innerHTML
                const container = document.createElement('div');
                container.innerHTML = output.content;
                // Execute any scripts in the HTML content
                executeScripts(container);
                outputRef.current?.appendChild(container);
              }
              
              // Update the output state with the current HTML content
              if (outputRef.current) {
                setOutput(outputRef.current.innerHTML);
              }
            },
            onStatus: (status) => {
              console.log('Execution status:', status);
            }
          });
        } catch (error) {
          console.error('Error executing code:', error);
          const errorMessage = error instanceof Error ? error.message : 'Error executing code';
          const errorDiv = document.createElement('pre');
          errorDiv.className = 'error-output text-red-600';
          // Convert ANSI escape codes in error messages too
          errorDiv.innerHTML = convert.toHtml(errorMessage);
          if (outputRef.current) {
            outputRef.current.innerHTML = '';
            outputRef.current.appendChild(errorDiv);
            setOutput(outputRef.current.innerHTML);
          }
        }
      }
    }
  }, [isReady, isExecuting, codeValue, executeCodeWithDOMOutput, onExecute]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the editor or its container has focus
      const isEditorFocused = editorRef.current?.hasTextFocus?.() || 
                             editorDivRef.current?.contains(document.activeElement);

      if (!isEditorFocused) return;

      // Shift + Enter to execute
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handleExecute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExecute]);

  return (
    <div className={`relative ${isActive ? 'editor-active' : ''}`}>
      <div className="relative" ref={editorDivRef}>
        <Editor
          height={editorHeight}
          language={language}
          value={codeValue}
          onChange={(value) => {
            setCodeValue(value || '');
            setTimeout(updateEditorHeight, 0);
          }}
          onMount={(editor) => {
            editorRef.current = editor;
            updateEditorHeight();
            editor.onDidContentSizeChange(() => {
              updateEditorHeight();
            });
            editor.updateOptions({
              padding: { top: 8, bottom: 8 }
            });
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            folding: true,
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
            lineHeight: 1.5,
            padding: { top: 8, bottom: 8 },
            glyphMargin: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'none',
            overviewRulerBorder: false,
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'hidden'
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            contextmenu: false
          }}
          className={`jupyter-editor ${isActive ? 'editor-active' : ''}`}
        />
        
        {/* Execution status indicator */}
        {isExecuting && (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-blue-500">Running...</span>
          </div>
        )}
      </div>

    
    </div>
  );
}; 