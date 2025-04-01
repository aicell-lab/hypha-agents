import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Editor } from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { RoleSelector, CellRole } from './RoleSelector';

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
  parent
}) => {
  const internalEditorRef = useRef<MonacoEditor | null>(null);
  const editorDivRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);
  const lineHeightPx = 19;
  const minLines = 3;
  const paddingHeight = 16;
  const monacoRef = useRef<any>(null);
  const [isFocused, setIsFocused] = useState(false);

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

  // Update editor height when content changes
  const updateEditorHeight = useCallback(() => {
    if (internalEditorRef.current) {
      const model = internalEditorRef.current.getModel();
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
  }, [content, updateEditorHeight]);

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

  // Function to handle editor mounting
  const handleEditorDidMount: OnMount = (editor) => {
    internalEditorRef.current = editor as unknown as MonacoEditor;
    if (editorRef) {
      (editorRef as any).current = {
        getValue: () => editor.getValue(),
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
    editor.setValue(content);
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
        handleRun();
      });
    }

    // Focus the editor if it's active
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

  // Function to handle editor changes
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
      setTimeout(updateEditorHeight, 0);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts if the editor has focus
      const isEditorFocused = internalEditorRef.current?.hasTextFocus?.() || 
                             editorDivRef.current?.contains(document.activeElement);

      if (!isEditorFocused) return;

      if (e.key === 'Enter' && e.shiftKey && isEditing) {
        e.preventDefault();
        e.stopPropagation(); // Stop event from bubbling to other handlers
        handleRun();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isEditing, handleRun]);

  // Handle focus and blur events
  useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      // Check if the focus is still within our cell
      const isInternalFocus = editorDivRef.current?.contains(e.relatedTarget as Node);
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

  return (
    <div 
      className={`relative markdown-cell ${isEditing ? 'editing' : ''} ${isActive ? 'active' : ''} ${parent ? 'child-cell' : 'parent-cell'}`}
      tabIndex={-1} // Make the container focusable
      data-parent={parent || undefined}
    >
      <div 
        className="jupyter-cell-flex-container" 
        ref={editorDivRef}
        tabIndex={-1} // Make the inner container focusable
      >
        {/* Add a placeholder for the execution count to match code cell alignment */}
        <div className="execution-count flex-shrink-0 flex flex-col items-end gap-1">
          {/* Empty placeholder for consistent alignment */}
          <div></div>
          {role !== undefined && onRoleChange && (
            <div className="pr-2">
              <RoleSelector role={role} onChange={onRoleChange} />
            </div>
          )}
        </div>
        <div className="editor-container w-full overflow-hidden">
          {isEditing ? (
            <Editor
              height={editorHeight}
              defaultLanguage="markdown"
              value={content}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              beforeMount={handleBeforeMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'off',
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
                  vertical: 'auto',
                  horizontalSliderSize: 4,
                  verticalSliderSize: 4,
                  horizontal: 'auto',
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
              className="jupyter-editor w-full"
            />
          ) : (
            <div 
              className="markdown-preview group relative overflow-x-auto w-[calc(100%-24px)] pt-2"
              onDoubleClick={() => onEditingChange?.(true)}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default MarkdownCell; 