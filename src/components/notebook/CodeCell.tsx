import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { RoleSelector } from './RoleSelector';
import { VscCode } from 'react-icons/vsc';
import { FaSpinner } from 'react-icons/fa';
import { JupyterOutput } from '../JupyterOutput';
import { OutputItem } from '../../types/notebook';
import { RiRobot2Line } from 'react-icons/ri';
import { outputAreaStyles } from '../../utils/ansi-utils';


// Register languages
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);

interface EditorAPI {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  getContainerDomNode: () => HTMLElement | null;
  hasTextFocus: () => boolean;
}

type CellRole = 'user' | 'assistant' | 'system';

interface CodeCellProps {
  code: string;
  language?: string;
  onExecute?: () => void;
  onAbort?: () => void;
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
  staged?: boolean; // Whether this is a staged (uncommitted) cell
  isReady?: boolean; // Kernel ready state from AgentLab
}

export const CodeCell: React.FC<CodeCellProps> = ({ 
  code, 
  language = 'python',
  onExecute,
  onAbort,
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
  output,
  staged = false,
  isReady = false
}) => {
  const [codeValue, setCodeValue] = useState(code);
  const internalEditorRef = useRef<EditorAPI | null>(null);
  const editorDivRef = useRef<HTMLDivElement>(null);
  const lineHeightPx = 20;
  const minLines = 2;
  const paddingHeight = 16;

  // Calculate initial editor height
  const calculateHeight = (content: string) => {
    const lineCount = Math.max(content.split('\n').length, minLines);
    return Math.max(lineCount * lineHeightPx + (paddingHeight * 2), 72); // Minimum 72px
  };

  const [editorHeight, setEditorHeight] = useState<number>(() => calculateHeight(code));
  const styleTagRef = useRef<HTMLStyleElement | null>(null);

  // Add a check for staged cells
  const isStagedCell = staged && parent;
  const isFullyCollapsed = (role === 'system' && hideCode) || (isStagedCell && hideCode);

  // Update editor height when content changes
  useEffect(() => {
    const newHeight = calculateHeight(codeValue);
    setEditorHeight(newHeight);
  }, [codeValue]);

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


  // Handle click on the editor container
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    // Check if the click is within an output area
    const isOutputAreaClick = (e.target as HTMLElement)?.closest('.jupyter-output-container');
    if (isOutputAreaClick) {
      return; // Don't shift focus if clicking in output area
    }
    
    // Only focus the editor if clicking directly in the editor area
    const isEditorClick = (e.target as HTMLElement)?.closest('.monaco-editor');
    if (isEditorClick && internalEditorRef.current) {
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

  // Add helper function to check for errors in output
  const hasErrors = useCallback(() => {
    if (!output || output.length === 0) return false;
    return output.some(item => item.type === 'stderr' || item.type === 'error');
  }, [output]);

  // Check if we should show the minimal view - now always true for system/staged cells when collapsed
  const shouldShowMinimalView = isFullyCollapsed && (role === 'system' || isStagedCell);

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

  // Add these styles for indentation error highlighting at the bottom of the file
  // These can be added to your CSS file or as a style tag
  const codeEditorStyles = `
    .indentation-error {
      background-color: rgba(255, 0, 0, 0.1);
      border-left: 2px solid red;
    }
  `;

  useEffect(() => {
    // Add the styles to the document
    const styleTag = document.createElement('style');
    styleTag.textContent = codeEditorStyles;
    document.head.appendChild(styleTag);
    
    return () => {
      styleTag.remove();
    };
  }, []);

  return (
    <div 
      ref={editorDivRef}
      className={`relative w-full code-cell ${isActive ? 'notebook-cell-active' : ''} ${role === 'system' ? 'system-cell' : ''} ${
        staged ? 'staged-cell bg-gray-50/50 border-gray-200' : ''
      }`}
      onClick={handleEditorClick}
      data-parent={parent || undefined}
      data-staged={staged || undefined}
    >
      {shouldShowMinimalView && (
        <>
          {/* Minimal icon view for collapsed system or staged cells */}
          <div 
            className={`flex items-center justify-center cursor-pointer rounded transition-colors mx-2 my-0.5 ${
              isExecuting 
                ? 'py-2 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 shadow-sm' 
                : isStagedCell
                  ? 'py-0.5 hover:bg-slate-100 border-l border-slate-200'
                  : hasErrors()
                    ? 'py-0.5 bg-red-50 hover:bg-red-100 border border-red-200'
                    : 'py-0.5 hover:bg-gray-100'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              // For system cells, expand both code and output
              if (role === 'system') {
                onVisibilityChange?.(true);
                onOutputVisibilityChange?.(true);
              } else {
                onVisibilityChange?.(!hideCode);
                onOutputVisibilityChange?.(!hideOutput);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // For system cells, expand both code and output
                if (role === 'system') {
                  onVisibilityChange?.(true);
                  onOutputVisibilityChange?.(true);
                } else {
                  onVisibilityChange?.(!hideCode);
                  onOutputVisibilityChange?.(!hideOutput);
                }
              }
            }}
            title={isExecuting ? "Executing system configuration" : isStagedCell ? "Staged code (click to expand)" : "System Configuration"}
          >
            <div className={`flex items-center gap-2 transition-opacity ${
              isExecuting ? 'opacity-100' : hasErrors() ? 'opacity-100' : 'opacity-60 hover:opacity-100'
            }`}>
              {isExecuting ? (
                <FaSpinner className="w-4 h-4 text-yellow-600 animate-spin" />
              ) : isStagedCell ? (
                <VscCode className="w-3 h-3 text-slate-500" />
              ) : hasErrors() ? (
                <span className="text-red-500">⚠</span>
              ) : (
                <RiRobot2Line className="w-3 h-3 text-gray-500" />
              )}
              <span className={`${
                isExecuting ? 'text-sm font-medium text-yellow-700' : 
                isStagedCell ? 'text-sm text-slate-500' : 
                hasErrors() ? 'text-sm font-medium text-red-800' :
                'text-sm text-blue-800'
              }`}>
                {isExecuting ? "Executing startup script..." : 
                 isStagedCell ? "Uncommitted code" : 
                 hasErrors() ? "System Configuration (with errors)" :
                 "System Configuration"}
              </span>
            </div>
          </div>

          {/* Show error outputs if they exist */}
          {!staged && hasErrors() && output && output.length > 0 && (
            <div className="jupyter-cell-flex-container mt-1">
              <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
                <div className="text-gray-500">
                  {executionCount ? `[${executionCount}]:` : '[*]:'}
                </div>
              </div>
              <div className="w-[calc(100%-28px)] overflow-visible bg-red-50 rounded-md">
                <JupyterOutput 
                  outputs={output.filter(item => item.type === 'stderr' || item.type === 'error')} 
                  className="output-area ansi-enabled" 
                  wrapLongLines={true} 
                />
              </div>
            </div>
          )}
        </>
      )}

      {!shouldShowMinimalView && (
        <div className="jupyter-cell-flex-container items-start w-full max-w-full">
          {/* Execution count with role icon */}
          <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
            {!isExecuting && onRoleChange && (
              <div className="pr-2">
                <RoleSelector role={role} onChange={onRoleChange} />
              </div>
            )}
            {isExecuting ? (
              <div className="text-gray-500 pr-2">
                <FaSpinner className="w-4 h-4 animate-spin text-yellow-500" />
              </div>
            ) : (
              <div className="text-gray-500">
                {executionCount ? `[${executionCount}]:` : '[*]:'}
              </div>
            )}
          </div>
          
          {/* Editor */}
          <div className={`editor-container mt-2 w-full overflow-hidden ${
            isActive ? 'editor-container-active' : ''
          } ${staged ? 'border-slate-200 pl-2' : ''} ${
            role === 'system' ? 'bg-gray-50/50' : ''
          }`}>
            {/* Staged indicator for expanded cells */}
            {staged && !hideCode && (
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                <span>Staged code (uncommitted)</span>
              </div>
            )}
            
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
                {staged && (
                  <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                    Staged
                  </span>
                )}
              </div>
            )}

            {/* Expandable Code Editor - Using CodeMirror */}
            {!hideCode && (
              <CodeMirrorEditor
                value={codeValue}
                language={language as 'python' | 'javascript' | 'markdown'}
                onChange={(value) => {
                  setCodeValue(value);
                  onChange?.(value);
                }}
                onExecute={handleExecute}
                height={editorHeight}
                editorRef={internalEditorRef}
              />
            )}
          </div>
        </div>
      )}

      {/* Output Area - only show if not fully collapsed */}
      {!isFullyCollapsed && ((output && output.length > 0) || isExecuting) && (
        <div className={`jupyter-cell-flex-container mt-1 ${parent ? 'child-cell' : 'parent-cell'}`}>
          {/* Empty execution count to align with code - only shown when output is visible */}
          {!hideOutput && (
            <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
              {isExecuting ? (
                <div className="text-gray-500 pr-2 flex items-center gap-2">
                  <FaSpinner className="w-4 h-4 animate-spin text-yellow-500" />
                </div>
              ) : (
                <div className="text-gray-500">
                  {executionCount ? `[${executionCount}]:` : '[*]:'}
                </div>
              )}
            </div>
          )}
          <div className="w-[calc(100%-28px)] overflow-visible relative group">
            {/* Hide button - only shown when output is visible */}
            {!hideOutput && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
                <button
                  onClick={handleOutputVisibilityToggle}
                  className="bg-white shadow-sm rounded text-xs flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-800 select-none"
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
                {isExecuting && onAbort && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAbort();
                    }}
                    className="bg-white shadow-sm rounded text-xs flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-red-50 border border-red-200 text-red-600 hover:text-red-700 select-none"
                    title="Stop execution"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Stop</span>
                  </button>
                )}
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
                {isExecuting && !output?.length && (
                  <div className="p-2 text-sm text-gray-500 flex items-center gap-2">
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Executing...</span>
                  </div>
                )}
                {output && output.length > 0 && (
                  <JupyterOutput 
                    outputs={output} 
                    className="output-area ansi-enabled" 
                    wrapLongLines={true} 
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};