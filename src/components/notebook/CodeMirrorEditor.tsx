import React, { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, ViewUpdate } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput
} from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { search, searchKeymap } from '@codemirror/search';
import { EditorView as EditorViewType } from '@codemirror/view';

// Jupyter notebook theme for CodeMirror
const jupyterTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    fontFamily: 'Monaco, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
    backgroundColor: '#f7f7f7',
    border: '1px solid #cfcfcf',
    borderRadius: '2px'
  },
  '.cm-content': {
    caretColor: '#000',
    padding: '4px 0',
    lineHeight: '1.21429em'
  },
  '.cm-line': {
    padding: '0 10px'
  },
  '.cm-cursor': {
    borderLeftColor: '#000',
    borderLeftWidth: '1px'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: '#d7d4f0'
  },
  '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
    backgroundColor: '#d7d4f0'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent'
  },
  '.cm-gutters': {
    backgroundColor: '#f7f7f7',
    color: '#999',
    border: 'none',
    borderRight: '1px solid #e0e0e0'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent'
  },
  '&.cm-focused': {
    outline: 'none',
    border: '1px solid #66afe9',
    boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.075), 0 0 8px rgba(102,175,233,0.6)'
  }
}, { dark: false });

interface CodeMirrorEditorProps {
  value: string;
  language?: 'python' | 'javascript' | 'markdown';
  onChange?: (value: string) => void;
  onExecute?: () => void;
  readOnly?: boolean;
  height?: string | number;
  autoFocus?: boolean;
  editorRef?: React.MutableRefObject<{
    getValue: () => string;
    setValue: (value: string) => void;
    focus: () => void;
    getContainerDomNode: () => HTMLElement | null;
    hasTextFocus: () => boolean;
  } | null>;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  language = 'python',
  onChange,
  onExecute,
  readOnly = false,
  height = 'auto',
  autoFocus = false,
  editorRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorViewType | null>(null);

  // Get language extension
  const getLanguageExtension = useCallback((): Extension => {
    switch (language) {
      case 'python':
        return python();
      case 'javascript':
        return javascript();
      case 'markdown':
        return markdown();
      default:
        return python();
    }
  }, [language]);

  // Create editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Custom keymap for Shift+Enter
    const customKeymap = keymap.of([
      {
        key: 'Shift-Enter',
        run: () => {
          onExecute?.();
          return true;
        }
      },
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      indentWithTab
    ]);

    const extensions: Extension[] = [
      getLanguageExtension(),
      jupyterTheme,
      syntaxHighlighting(defaultHighlightStyle),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      search(),
      history(),
      foldGutter(),
      indentOnInput(),
      customKeymap,
      EditorView.lineWrapping,
      EditorState.tabSize.of(4),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged && onChange) {
          const newValue = update.state.doc.toString();
          onChange(newValue);
        }
      })
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const state = EditorState.create({
      doc: value,
      extensions
    });

    const view = new EditorView({
      state,
      parent: containerRef.current
    });

    viewRef.current = view;

    // Auto-focus if requested
    if (autoFocus) {
      view.focus();
    }

    // Expose editor API through ref
    if (editorRef) {
      editorRef.current = {
        getValue: () => view.state.doc.toString(),
        setValue: (newValue: string) => {
          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: newValue
            }
          });
        },
        focus: () => view.focus(),
        getContainerDomNode: () => containerRef.current,
        hasTextFocus: () => view.hasFocus
      };
    }

    // Cleanup
    return () => {
      view.destroy();
      if (editorRef) {
        editorRef.current = null;
      }
    };
  }, [getLanguageExtension, onChange, onExecute, readOnly, autoFocus, editorRef]);

  // Update content when value prop changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: value
          }
        });
      }
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        minHeight: '72px',
        overflow: 'auto'
      }}
      className="codemirror-container"
    />
  );
};
