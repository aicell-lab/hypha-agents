import { useCallback, useEffect } from 'react';
import { CellManager } from '../pages/CellManager';

interface NotebookKeyboardShortcutsProps {
  cellManager: CellManager | null;
  isEditing: boolean;
}

export const useNotebookKeyboardShortcuts = ({
  cellManager,
  isEditing
}: NotebookKeyboardShortcutsProps) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if cellManager is not available
    if (!cellManager) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? event.metaKey : event.ctrlKey;

    // Check if we're in a code editor or text input
    const activeElement = document.activeElement;
    const isInEditor = activeElement?.classList.contains('monaco-editor') ||
                      activeElement?.tagName === 'TEXTAREA' ||
                      activeElement?.tagName === 'INPUT' ||
                      // Check for Monaco editor's internal textarea
                      activeElement?.classList.contains('inputarea');

    // If we're in an editor, don't handle cell-level shortcuts
    if (isInEditor) {
      return;
    }

    if (modifierKey) {
      switch (event.key.toLowerCase()) {
        case 'z':
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl/Cmd + Shift + Z = Redo
            cellManager.redo();
          } else {
            // Ctrl/Cmd + Z = Undo
            cellManager.undo();
          }
          break;

        case 'y':
          // Ctrl/Cmd + Y = Redo (Windows style)
          if (!isMac) {
            event.preventDefault();
            cellManager.redo();
          }
          break;

        case 'x':
          // Ctrl/Cmd + X = Cut
          if (cellManager.activeCellId) {
            event.preventDefault();
            cellManager.cutCells([cellManager.activeCellId]);
          }
          break;

        case 'c':
          // Ctrl/Cmd + C = Copy
          if (cellManager.activeCellId) {
            event.preventDefault();
            cellManager.copyCells([cellManager.activeCellId]);
          }
          break;

        case 'v':
          // Ctrl/Cmd + V = Paste
          event.preventDefault();
          cellManager.pasteCells();
          break;
      }
    }
  }, [cellManager]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}; 