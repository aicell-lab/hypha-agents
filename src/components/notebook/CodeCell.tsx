import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useThebe } from '../chat/ThebeProvider';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import Editor, { OnMount } from '@monaco-editor/react';
import { executeScripts } from '../../utils/script-utils';
import { processTextOutput, processAnsiInOutputElement, outputAreaStyles } from '../../utils/ansi-utils';
import Convert from 'ansi-to-html';
import { RoleSelector } from './RoleSelector';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';
import { FaSpinner } from 'react-icons/fa';

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

type CellRole = 'user' | 'assistant' | 'system';

interface CodeCellProps {
  code: string;
  language?: string;
  defaultCollapsed?: boolean;
  initialStatus?: string;
  domContent?: string;
  onExecute?: () => void;
  isExecuting?: boolean;
  executionCount?: number;
  blockRef?: React.RefObject<{
    getCurrentCode: () => string;
    focus: () => void;
    getContainerDomNode: () => HTMLElement | null;
  }>;
  isActive?: boolean;
  role?: CellRole;
  onRoleChange?: (role: CellRole) => void;
  onChange?: (value: string) => void;
  hideCode?: boolean;
  onVisibilityChange?: (isVisible: boolean) => void;
  parent?: string;
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
  onChange,
  hideCode = false,
  onVisibilityChange,
  parent
}) => {
  const { executeCodeWithDOMOutput, status, isReady } = useThebe();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [codeValue, setCodeValue] = useState(code);
  const [output, setOutput] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);
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
          const node = internalEditorRef.current.getContainerDomNode();
          if (node) node.focus();
        }
      }
    },
    getContainerDomNode: () => {
      const node = internalEditorRef.current?.getContainerDomNode();
      return node || null;
    }
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
  const handleEditorDidMount: OnMount = (editor, monaco) => {
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

  // Handle visibility toggle with direct parent notification
  const handleVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onVisibilityChange?.(!hideCode);
  };

  // Get the first line of actual code for preview
  const getCodePreview = () => {
    if (!codeValue) return '';
    
    // Get first non-empty line that isn't a comment
    const firstLine = codeValue.split('\n')
      .find(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('#');
      }) || '';
    
    // Truncate if too long
    return firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;
  };

  return (
    <div 
      ref={editorDivRef}
      className={`relative w-full code-cell ${isActive ? 'notebook-cell-active' : ''} ${parent ? 'child-cell' : ''}`}
      onClick={handleEditorClick}
      data-parent={parent || undefined}
    >
      <div className="jupyter-cell-flex-container items-start w-full max-w-full">
        {/* Execution count with role icon */}
        <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
        {role !== undefined && onRoleChange && (
            <div className="pr-2">
              <RoleSelector role={role} onChange={onRoleChange} />
            </div>
          )}
          <div className="text-gray-500">
            {isExecuting 
              ? '[*]:'
              : executionCount
              ? `[${executionCount}]:`
              : ''}
          </div>
          
        </div>
        
        {/* Editor */}
        <div className={`editor-container w-full overflow-hidden ${isActive ? 'editor-container-active' : ''}`}>
          {/* Collapsed Code Cell Header */}
          {hideCode && (
            <div 
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-t-md cursor-pointer hover:bg-gray-100 transition-colors relative"
              onClick={handleVisibilityToggle}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleVisibilityToggle(e as any);
                }
              }}
            >
              <svg 
                className={`w-4 h-4 text-gray-500 transform transition-transform ${hideCode ? 'rotate-0' : 'rotate-90'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm text-gray-600 font-mono">
                {language === 'python' ? 'Python Code' : language}
                {getCodePreview() && ` • ${getCodePreview()}`}
              </span>
            </div>
          )}

          {/* Cell Toolbar - Show on hover */}
          <div 
            className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded px-1 z-10 hover:opacity-100"
            style={{ pointerEvents: hideCode ? 'none' : 'auto' }}
          >
            {/* Cell Type Indicator */}
            <span className="text-xs text-gray-500 px-1 border-r border-gray-200 mr-1">
              <span className="flex items-center gap-1">
                <VscCode className="w-3 h-3" />
                Code
              </span>
            </span>

            {/* Run Button */}
            <button
              onClick={onExecute}
              disabled={!isReady || isExecuting}
              className="p-1 hover:bg-gray-100 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Run cell"
            >
              {isExecuting ? (
                <FaSpinner className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-xs">Run</span>
            </button>

            {/* Convert Button */}
            <button
              onClick={() => onChange?.('markdown')}
              className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
              title="Convert to Markdown"
              disabled={isExecuting}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="text-xs">Convert</span>
            </button>
          </div>

          {/* Expandable Code Editor */}
          {!hideCode && (
            <div className="relative">
              <Editor
                height={editorHeight}
                language={language}
                value={codeValue}
                onChange={(value) => {
                  const newValue = value || '';
                  setCodeValue(newValue);
                  onChange?.(newValue);
                  setTimeout(updateEditorHeight, 10);
                }}
                onMount={handleEditorDidMount}
                beforeMount={handleBeforeMount}
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
          )}
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