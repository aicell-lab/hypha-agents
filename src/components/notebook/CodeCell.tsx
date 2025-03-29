import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useThebe } from '../chat/ThebeProvider';
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
import { RoleSelector, CellRole } from './RoleSelector';
import type { OnMount } from '@monaco-editor/react';

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

interface MonacoEditor {
  getValue: () => string;
  getModel: () => any;
  getVisibleRanges: () => any;
  hasTextFocus: () => boolean;
  focus: () => void;
  getContainerDomNode: () => HTMLElement | null;
  onDidContentSizeChange: (callback: () => void) => void;
  updateOptions: (options: any) => void;
  addCommand: (keybinding: number, handler: () => void) => void;
  setValue: (value: string) => void;
}

interface CodeCellProps {
  code: string;
  language?: string;
  defaultCollapsed?: boolean;
  initialStatus?: string;
  domContent?: string;
  onExecute?: () => void;
  isExecuting?: boolean;
  executionCount?: number;
  blockRef?: React.RefObject<any>;
  isActive?: boolean;
  role?: CellRole;
  onRoleChange?: (role: CellRole) => void;
  onChange?: (code: string) => void;
}

export const CodeCell: React.FC<CodeCellProps> = ({ 
  code, 
  language = 'python',
  defaultCollapsed = false,
  initialStatus = '',
  domContent = '',
  onExecute,
  isExecuting = false,
  executionCount,
  blockRef,
  isActive = false,
  role,
  onRoleChange,
  onChange
}) => {
  const { executeCodeWithDOMOutput, status, isReady } = useThebe();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [codeValue, setCodeValue] = useState(code);
  const [output, setOutput] = useState<string>('');
  const outputRef = useRef<HTMLDivElement>(null);
  const internalEditorRef = useRef<MonacoEditor | null>(null);
  const editorDivRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);
  const lineHeightPx = 19;
  const minLines = 3;
  const paddingHeight = 16;
  const monacoRef = useRef<any>(null);
  const hasFinalDomOutput = useRef<boolean>(false);
  const styleTagRef = useRef<HTMLStyleElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Calculate initial height based on content
  const calculateInitialHeight = useCallback((content: string) => {
    const lineCount = content.split('\n').length;
    return Math.max(lineCount * lineHeightPx + paddingHeight, minLines * lineHeightPx + paddingHeight);
  }, []);

  // Set initial height when component mounts
  useEffect(() => {
    setEditorHeight(calculateInitialHeight(code));
  }, [code, calculateInitialHeight]);

  // Expose methods through ref
  React.useImperativeHandle(blockRef, () => ({
    getCurrentCode: () => internalEditorRef.current?.getValue() || codeValue,
    focus: () => {
      if (internalEditorRef.current) {
        if (typeof internalEditorRef.current.focus === 'function') {
          internalEditorRef.current.focus();
        } else if (internalEditorRef.current.getContainerDomNode) {
          internalEditorRef.current.getContainerDomNode()?.focus();
        }
      }
    },
    getContainerDomNode: () => internalEditorRef.current?.getContainerDomNode()
  }), [codeValue]);

  // Add output area styles
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.textContent = outputAreaStyles;
    document.head.appendChild(styleTag);
    styleTagRef.current = styleTag;
    
    // Cleanup on unmount
    return () => {
      if (styleTagRef.current) {
        styleTagRef.current.remove();
        styleTagRef.current = null;
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
    if (internalEditorRef.current) {
      const model = internalEditorRef.current.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        // Add extra lines to account for widgets and prevent scrolling issues
        const extraLines = 1;
        const newHeight = Math.max(
          (lineCount + extraLines) * lineHeightPx + paddingHeight, 
          minLines * lineHeightPx + paddingHeight
        );
        setEditorHeight(newHeight);
      }
    }
  }, []);

  // Update height when content changes
  useEffect(() => {
    updateEditorHeight();
  }, [codeValue, updateEditorHeight]);

  // Handle wheel events to prevent editor from capturing page scrolls
  useEffect(() => {
    if (!editorDivRef.current) return;

    const handleWheel = (e: WheelEvent) => {
      // Get the editor element
      const editor = internalEditorRef.current;
      if (!editor) return;

      const model = editor.getModel();
      if (!model) return;
      
      const lineCount = model.getLineCount();
      const visibleRanges = editor.getVisibleRanges();
      
      // Check if we're at the top or bottom of the editor content
      const isAtTop = visibleRanges.length > 0 && visibleRanges[0].startLineNumber <= 1;
      const isAtBottom = visibleRanges.length > 0 && 
                         visibleRanges[visibleRanges.length - 1].endLineNumber >= lineCount;
      
      // If scrolling up at the top or down at the bottom, let the page scroll
      if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
        // Don't prevent default - let the page scroll
        return;
      }
      
      // Otherwise, we're within the editor's content, handle normally
      // but don't prevent the event from propagating
    };
    
    editorDivRef.current.addEventListener('wheel', handleWheel, { passive: true });
    
    return () => {
      editorDivRef.current?.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Handle code execution
  const handleExecute = useCallback(async () => {
    if (!isReady || isExecuting) return;
    
    // Get the current value from the editor
    const currentCode = internalEditorRef.current?.getValue() || codeValue;
    
    if (onExecute) {
      onExecute();
    } else {
      // Fallback to local execution if no onExecute provided
      if (outputRef.current) {
        // Clear previous output
        outputRef.current.innerHTML = '';
        setOutput('');
        hasFinalDomOutput.current = false;
        
        try {
          await executeCodeWithDOMOutput(currentCode, outputRef.current, {
            onOutput: (output) => {
              // For non-HTML outputs, create appropriate DOM elements
              if (hasFinalDomOutput.current) return;
              
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
                
                if (outputRef.current && !hasFinalDomOutput.current) {
                  outputRef.current.appendChild(container);
                }
              }
              
              // Update the output state with the current HTML content
              if (outputRef.current && !hasFinalDomOutput.current) {
                setOutput(outputRef.current.innerHTML);
              }
            },
            onStatus: (status) => {
              console.log('Execution status:', status);
              
              if (status === 'Completed' && outputRef.current) {
                // When execution completes, use the final DOM output
                hasFinalDomOutput.current = true;
                setOutput(outputRef.current.innerHTML);
              }
            }
          });
        } catch (error) {
          console.error('Error executing code:', error);
          const errorMessage = error instanceof Error ? error.message : 'Error executing code';
          
          // Only add error message if we don't already have output
          if (!hasFinalDomOutput.current) {
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
    }
  }, [isReady, isExecuting, codeValue, executeCodeWithDOMOutput, onExecute]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the editor or its container has focus
      const isEditorFocused = internalEditorRef.current?.hasTextFocus?.() || 
                             editorDivRef.current?.contains(document.activeElement);

      if (!isEditorFocused) return;

      // Shift + Enter to execute
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation(); // Stop event from bubbling to other handlers
        handleExecute();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleExecute]);

  // Function to handle editor mounting
  const handleEditorDidMount: OnMount = (editor) => {
    internalEditorRef.current = editor as unknown as MonacoEditor;
    if (blockRef) {
      (blockRef as any).current = {
        getCurrentCode: () => editor.getValue(),
        focus: () => {
          if (typeof editor.focus === 'function') {
            editor.focus();
          } else if (editor.getContainerDomNode) {
            editor.getContainerDomNode()?.focus();
          }
        },
        getContainerDomNode: () => editor.getContainerDomNode()
      };
    }
    editor.setValue(code);
    updateEditorHeight();
    editor.onDidContentSizeChange(() => {
      updateEditorHeight();
    });
    editor.updateOptions({
      padding: { top: 8, bottom: 8 }
    });

    // Add keyboard shortcut handler for Shift+Enter
    if (monacoRef.current) {
      editor.addCommand(monacoRef.current.KeyMod.Shift | monacoRef.current.KeyCode.Enter, () => {
        onExecute?.();
      });
    }

    // Focus the editor if this is active
    if (isActive) {
      setTimeout(() => {
        if (typeof editor.focus === 'function') {
          editor.focus();
        } else if (editor.getContainerDomNode) {
          editor.getContainerDomNode()?.focus();
        }
      }, 100);
    }
  };

  // Handle Monaco instance before mounting the editor
  const handleBeforeMount = (monaco: any) => {
    monacoRef.current = monaco;
  };

  // Handle click on the editor container
  const handleEditorClick = useCallback(() => {
    // If there's a way to set active cell in parent, this would be done through props
    if (internalEditorRef.current) {
      // Force focus on the editor
      internalEditorRef.current.focus();
    }
  }, []);

  return (
    <div 
      ref={editorDivRef}
      className={`relative w-full code-cell ${isActive ? 'notebook-cell-active' : ''}`}
      onClick={handleEditorClick}
    >
      <div className="jupyter-cell-flex-container items-start w-full max-w-full">
        {/* Execution count with role icon */}
        <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
          <div className="text-gray-500">
            {isExecuting 
              ? '[*]:'
              : executionCount
              ? `[${executionCount}]:`
              : ''}
          </div>
          {role !== undefined && onRoleChange && (
            <div className="pr-2">
              <RoleSelector role={role} onChange={onRoleChange} />
            </div>
          )}
        </div>
        
        {/* Editor */}
        <div className={`editor-container w-full overflow-hidden ${isActive ? 'editor-container-active' : ''}`}>
          <Editor
            height={editorHeight}
            language={language}
            value={codeValue}
            onChange={(value) => {
              const newValue = value || '';
              setCodeValue(newValue);
              onChange?.(newValue);
              // Update editor height with a slight delay to ensure content is processed
              setTimeout(updateEditorHeight, 10);
            }}
            onMount={handleEditorDidMount}
            beforeMount={handleBeforeMount}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on', // Enable line numbers
              renderWhitespace: 'selection',
              folding: true,
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
              lineHeight: 1.5,
              padding: { top: 8, bottom: 8 },
              glyphMargin: false,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 2,
              renderLineHighlight: 'none',
              overviewRulerBorder: false,
              scrollbar: {
                vertical: 'auto',
                horizontalSliderSize: 4,
                verticalSliderSize: 4,
                horizontal: 'hidden',
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false,
                alwaysConsumeMouseWheel: false
              },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              contextmenu: false,
              fixedOverflowWidgets: true,
              automaticLayout: true
            }}
            className="jupyter-editor w-full max-w-full overflow-x-hidden"
          />
        </div>
      </div>
      
      {isExecuting && (
        <div className="absolute right-3 top-3 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500"></div>
        </div>
      )}
      
      {/* Output area with execution count spacing */}
      {outputRef.current && outputRef.current.innerHTML && (
        <div className="jupyter-cell-flex-container mt-1">
          <div className="execution-count flex-shrink-0">
            {/* Empty space to align with code */}
          </div>
          <div className="editor-container w-full overflow-hidden">
            <div 
              ref={outputRef} 
              className="output-area bg-gray-50 p-2 rounded-b-md w-full overflow-x-auto border-none"
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};