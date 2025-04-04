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
import { JupyterOutput } from '../JupyterOutput';
import { OutputItem } from '../chat/Chat';
import { RiRobot2Line } from 'react-icons/ri';

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
  hideOutput?: boolean;
  onOutputVisibilityChange?: (isVisible: boolean) => void;
  parent?: string;
  output?: OutputItem[];
}

export const CodeCell: React.FC<CodeCellProps> = ({ 
  code, 
  language = 'python',
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
  hideOutput = false,
  onOutputVisibilityChange,
  parent,
  output
}) => {
  const { status, isReady } = useThebe();
  const [codeValue, setCodeValue] = useState(code);
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
    
    if (onExecute) {
      onExecute();
    } else {
      console.error("No onExecute function provided");
      throw new Error("No onExecute function provided");
    }
  }, [isReady, isExecuting, codeValue, onExecute]);

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

  // Handle output visibility toggle
  const handleOutputVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOutputVisibilityChange?.(!hideOutput);
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

  // Add a check for fully collapsed system cell
  const isFullyCollapsed = role === 'system' && hideCode;

  return (
    <div 
      ref={editorDivRef}
      className={`relative w-full code-cell ${isActive ? 'notebook-cell-active' : ''} ${parent ? 'child-cell' : 'parent-cell'} ${role === 'system' ? 'bg-gray-50' : ''}`}
      onClick={handleEditorClick}
      data-parent={parent || undefined}
    >
      {isFullyCollapsed ? (
        // Minimal icon view for collapsed system cells
        <div 
          className="flex items-center justify-center py-0.5 cursor-pointer hover:bg-gray-100 rounded transition-colors min-h-[24px] mx-2 my-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityChange?.(!hideCode);
            onOutputVisibilityChange?.(!hideOutput);
          }}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onVisibilityChange?.(!hideCode);
              onOutputVisibilityChange?.(!hideOutput);
            }
          }}
          title="System Configuration"
        >
          <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
            <RiRobot2Line className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">System Configuration</span>
          </div>
        </div>
      ) : (
        <div className="jupyter-cell-flex-container items-start w-full max-w-full">
          {/* Execution count with role icon */}
          <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
            {!isExecuting &&role !== undefined && onRoleChange && (
              <div className="pr-1">
                <RoleSelector role={role} onChange={onRoleChange} />
              </div>
            )}
            {isExecuting ? (
              <div className="text-gray-500 pr-2">
                <FaSpinner className="w-4 h-4 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="text-gray-500">
                {executionCount ? `[${executionCount}]:` : '[*]:'}
              </div>
            )}
          </div>
          
          {/* Editor */}
          <div className={`editor-container mt-2 w-full overflow-hidden ${isActive ? 'editor-container-active' : ''}`}>
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
      )}

      {/* Output Area - only show if not fully collapsed */}
      {!isFullyCollapsed && output && output.length > 0 && (
        <div className={`jupyter-cell-flex-container mt-1 ${parent ? 'child-cell' : 'parent-cell'}`}>
          {/* Empty execution count to align with code - only shown when output is visible */}
          {!hideOutput && (
            <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
              {isExecuting ? (
                <div className="text-gray-500 pr-2">
                  <FaSpinner className="w-4 h-4 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="text-gray-500">
                  {executionCount ? `[${executionCount}]:` : '[*]:'}
                </div>
              )}
            </div>
          )}
          <div className="w-full overflow-visible relative group">
            {/* Hide button - only shown when output is visible */}
            {!hideOutput && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={handleOutputVisibilityToggle}
                  className="bg-white shadow-sm rounded text-xs flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-800"
                  title="Hide output"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  <span>Hide</span>
                </button>
              </div>
            )}

            {hideOutput ? (
              <div 
                onClick={handleOutputVisibilityToggle}
                className="h-[20px] flex items-center justify-center cursor-pointer hover:bg-gray-50 rounded transition-colors duration-150"
                title="Show output"
              >
                <div className="inline-flex gap-1 items-center text-gray-400 text-xs">
                <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                  <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                  <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                </div>
              </div>
            ) : (
              <div className="output-area-container bg-gray-50 rounded-b-md border-none">
                <JupyterOutput 
                  outputs={output} 
                  className="output-area ansi-enabled" 
                  wrapLongLines={true} 
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};