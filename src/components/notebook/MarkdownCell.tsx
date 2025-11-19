import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { RoleSelector, CellRole } from './RoleSelector';
import { MdOutlineTextFields } from 'react-icons/md';

interface EditorAPI {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  getContainerDomNode: () => HTMLElement | null;
  hasTextFocus: () => boolean;
}

interface MarkdownCellProps {
  content: string;
  onChange: (content: string) => void;
  initialEditMode?: boolean;
  role?: CellRole;
  onRoleChange?: (role: CellRole) => void;
  isEditing?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  editorRef?: React.RefObject<any>;
  isActive?: boolean;
  parent?: string; // ID of parent cell (user message that triggered this cell)
  onRegenerateResponse?: () => void; // New prop for regenerating response
  staged?: boolean; // Whether this is a staged (uncommitted) cell
  hideContent?: boolean; // Whether to hide the cell content
  onVisibilityChange?: (isVisible: boolean) => void; // Callback to toggle visibility
}

const MarkdownCell: React.FC<MarkdownCellProps> = ({ 
  content, 
  onChange, 
  initialEditMode = false, 
  role, 
  onRoleChange,
  isEditing = false,
  onEditingChange,
  editorRef,
  isActive = false,
  parent,
  onRegenerateResponse,
  staged = false,
  hideContent = false,
  onVisibilityChange
}) => {
  const internalEditorRef = useRef<EditorAPI | null>(null);
  const editorDivRef = useRef<HTMLDivElement>(null);
  const lineHeightPx = 17; // 14px font * 1.21429em line-height
  const minLines = 1;
  const paddingHeight = 10; // Actual padding in CodeMirror

  // Calculate initial editor height
  const calculateHeight = (text: string) => {
    const lineCount = Math.max(text.split('\n').length, minLines);
    return Math.max(lineCount * lineHeightPx + paddingHeight, 36); // Minimum 36px for single line
  };

  const [editorHeight, setEditorHeight] = useState<number>(() => calculateHeight(content));
  const [isFocused, setIsFocused] = useState(false);
  
  // Add a check for staged cells
  const isStagedCell = staged && parent;
  const isFullyCollapsed = isStagedCell && hideContent;

  // Function to handle regenerate response
const handleRegenerateResponse = useCallback(() => {
    if (onRegenerateResponse) {
      onRegenerateResponse();
    }
  }, [onRegenerateResponse]);

  // Function to handle visibility toggle
  const handleVisibilityToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onVisibilityChange?.(!hideContent);
  };

  // Update effect to handle edit mode based on active state and empty content
  useEffect(() => {
    // Only enter edit mode if:
    // 1. The cell is active AND either:
    //    a. It's a new cell (empty content)
    //    b. It's explicitly set to initialEditMode
    // 2. We're not already in the desired state
    if (isActive && (initialEditMode || !content.trim()) && !isEditing) {
      onEditingChange?.(true);
    }
    // Exit edit mode when cell becomes inactive, but only if we're currently editing
    else if (!isActive && isEditing) {
      onEditingChange?.(false);
    }
  }, [isActive, initialEditMode]); // Only depend on active state and initial mode

  // Update height when content changes
  useEffect(() => {
    const newHeight = calculateHeight(content);
    setEditorHeight(newHeight);
  }, [content]);

  // Function to handle running/rendering markdown
  const handleRun = useCallback(() => {
    if (isEditing && internalEditorRef.current) {
      const latestContent = internalEditorRef.current.getValue();
      onChange(latestContent);
    }
    onEditingChange?.(false);
  }, [isEditing, onChange, onEditingChange]);

  // Expose methods through ref
  React.useImperativeHandle(editorRef, () => ({
    getValue: () => internalEditorRef.current?.getValue() || content,
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
  }), [content]);

  // Update effect to handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts if the editor has focus or the cell is active
      const isEditorFocused = internalEditorRef.current?.hasTextFocus?.() || 
                             editorDivRef.current?.contains(document.activeElement);

      // Check if Ctrl+Enter or Command+Enter was pressed
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        // For regenerate, this should work regardless of edit mode
        if (isEditorFocused || isFocused) {
          e.preventDefault();
          e.stopPropagation(); // Stop event from bubbling to other handlers
          handleRegenerateResponse();
          return;
        }
      }

      // Handle Shift+Enter - check both editor focus AND cell focus
      if (e.key === 'Enter' && e.shiftKey) {
        if (isEditorFocused || isFocused) {
          e.preventDefault();
          e.stopPropagation(); // Stop event from bubbling to other handlers
          if (isEditing) {
            handleRun();
          } else {
            handleRegenerateResponse();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isEditing, handleRun, handleRegenerateResponse, isFocused]);

  // Handle focus and blur events
  useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      // Add a small delay to allow the CodeMirror editor to mount and receive focus
      // This prevents the editor from immediately closing when switching from preview to edit mode
      setTimeout(() => {
        // Check if the focus is still within our cell
        const isInternalFocus = editorDivRef.current?.contains(document.activeElement);
        if (!isInternalFocus && isEditing) {
          // Save content before exiting edit mode
          if (internalEditorRef.current) {
            const latestContent = internalEditorRef.current.getValue();
            onChange(latestContent);
          }
          // Exit edit mode
          onEditingChange?.(false);
          setIsFocused(false);
        }
      }, 100);
    };

    const currentEditorDiv = editorDivRef.current;
    if (currentEditorDiv) {
      currentEditorDiv.addEventListener('focusout', handleFocusOut);
    }

    return () => {
      if (currentEditorDiv) {
        currentEditorDiv.removeEventListener('focusout', handleFocusOut);
      }
    };
  }, [isEditing, onChange, onEditingChange]);

  // Get a preview of the markdown content
  const getContentPreview = () => {
    if (!content) return '';
    
    // Get first line that has content
    const firstLine = content.split('\n')
      .find(line => line.trim().length > 0) || '';
    
    // Truncate if too long
    return firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;
  };

  return (
    <div 
      className={`relative markdown-cell ${isEditing ? 'editing' : ''} ${isActive ? 'active' : ''} ${staged ? 'staged-cell bg-gray-50/50 border-l-2 border-gray-200' : ''}`}
      tabIndex={-1} // Make the container focusable
      data-parent={parent || undefined}
      data-staged={staged || undefined}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Only set unfocused if the focus is leaving the entire cell
        if (!editorDivRef.current?.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
      onClick={(e) => {
        // Only focus the editor if clicking directly in the editor area
        const isEditorClick = (e.target as HTMLElement)?.closest('.cm-editor');
        if (isEditorClick && internalEditorRef.current) {
          internalEditorRef.current.focus();
        }
      }}
    >
      {isFullyCollapsed ? (
        // Minimal view for collapsed staged markdown cells
        <div 
          className="flex items-center justify-center cursor-pointer rounded transition-colors mx-2 my-0.5 py-0.5 hover:bg-slate-100 border-l border-slate-200"
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityChange?.(!hideContent);
          }}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onVisibilityChange?.(!hideContent);
            }
          }}
          title="Staged markdown (click to expand)"
        >
          <div className="flex items-center gap-2 transition-opacity opacity-60 hover:opacity-100">
            <MdOutlineTextFields className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-500">
              Staged markdown
            </span>
          </div>
        </div>
      ) : (
        <div 
          className="jupyter-cell-flex-container" 
          ref={editorDivRef}
          tabIndex={-1} // Make the inner container focusable
        >
          {/* Add a placeholder for the execution count to match code cell alignment */}
          <div className="execution-count flex-shrink-0 flex flex-col items-end gap-1">
            {/* Empty placeholder for consistent alignment */}
            <div></div>
            {onRoleChange && (
              <div className="pr-2">
                <RoleSelector role={role} onChange={onRoleChange} />
              </div>
            )}
          </div>
          <div className={`editor-container w-full overflow-hidden ${staged ? 'border-l-2 border-slate-200 pl-2' : 'mt-1'}`}>
            {/* Staged indicator for expanded cells */}
            {staged && (
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                <span>Staged markdown (uncommitted)</span>
              </div>
            )}
            
            {/* Collapsed MarkdownCell Header */}
            {hideContent && !isFullyCollapsed && (
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
                  className={`w-4 h-4 text-gray-500 transform transition-transform ${hideContent ? 'rotate-0' : 'rotate-90'}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm text-gray-600">
                  Markdown {getContentPreview() && ` • ${getContentPreview()}`}
                </span>
                {staged && (
                  <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                    Staged
                  </span>
                )}
              </div>
            )}
            
            {(!hideContent || isEditing) && (
              isEditing ? (
                <CodeMirrorEditor
                  value={content}
                  language="markdown"
                  onChange={onChange}
                  onExecute={handleRun}
                  height={editorHeight}
                  autoFocus
                  editorRef={internalEditorRef}
                />
              ) : (
                <div 
                  className="markdown-preview group relative overflow-x-auto w-[calc(100%-24px)] pt-2"
                  onDoubleClick={() => onEditingChange?.(true)}
                  tabIndex={0} // Make preview area focusable
                  onFocus={() => setIsFocused(true)}
                >
                  <div className="markdown-body py-2 overflow-auto break-words min-h-[60px]">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          return match ? (
                            <SyntaxHighlighter
                              style={oneLight}
                              language={match[1]}
                              PreTag="div"
                              wrapLines={true}
                              wrapLongLines={true}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownCell; 