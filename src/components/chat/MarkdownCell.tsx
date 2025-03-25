import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Editor, useMonaco } from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';

interface MarkdownCellProps {
  content: string;
  onChange: (content: string) => void;
  initialEditMode?: boolean;
}

const MarkdownCell: React.FC<MarkdownCellProps> = ({ content, onChange, initialEditMode = false }) => {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const editorDivRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number>(0);
  const lineHeightPx = 19;
  const minLines = 3;
  const paddingHeight = 16;
  const monaco = useMonaco();

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
  }, [content, updateEditorHeight]);

  // Function to handle running/rendering markdown
  const handleRun = useCallback(() => {
    if (isEditing && editorRef.current) {
      const latestContent = editorRef.current.getValue();
      onChange(latestContent);
    }
    setIsEditing(false);
  }, [isEditing, onChange]);

  // Function to handle editor mounting
  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.setValue(content);
    updateEditorHeight();
    editor.onDidContentSizeChange(() => {
      updateEditorHeight();
    });
    editor.updateOptions({
      padding: { top: 8, bottom: 8 }
    });

    // Add keyboard shortcut handler for Shift+Enter
    if (monaco) {
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        handleRun();
      });
    }
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
      const isEditorFocused = editorRef.current?.hasTextFocus?.() || 
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

  return (
    <div className={`relative markdown-cell ${isEditing ? 'editing' : ''}`}>
      <div className="jupyter-cell-flex-container" ref={editorDivRef}>
        {/* Add a placeholder for the execution count to match code cell alignment */}
        <div className="execution-count flex-shrink-0">
          {/* Empty placeholder for consistent alignment */}
        </div>
        <div className="editor-container w-full overflow-hidden">
          {isEditing ? (
            <Editor
              height={editorHeight}
              defaultLanguage="markdown"
              value={content}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'off', // Turn off line numbers to match code cells
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
              className="markdown-preview group relative overflow-x-auto w-full"
              onDoubleClick={() => setIsEditing(true)}
            >
              {/* Edit button - show on hover */}
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-600"
                  title="Edit markdown"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
              <div className="markdown-body py-2 overflow-auto break-words">
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