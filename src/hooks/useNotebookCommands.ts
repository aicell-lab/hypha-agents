import { useCallback } from 'react';
import { CellManager } from '../pages/CellManager';

interface UseNotebookCommandsProps {
  cellManager: CellManager;
  hasInitialized: React.MutableRefObject<boolean>;
}

export function useNotebookCommands({
  cellManager,
  hasInitialized
}: UseNotebookCommandsProps) {
  
  // Handle special commands
  const handleCommand = useCallback((command: string) => {
    const normalizedCommand = command.toLowerCase().trim();
    let newCellId = '';

    // Parse command and arguments
    const [cmd, ...args] = normalizedCommand.split(/\s+/);
    const content = args.join(' ');

    switch (cmd) {
      case '/code':
      case '#code':
        // Add new code cell with content if provided
        newCellId = cellManager.addCell('code', content, 'user');
        break;

      case '/markdown':
      case '#markdown':
        // Add new markdown cell with content if provided
        newCellId = cellManager.addCell('markdown', content, 'user');
        break;

      case '/clear':
        // Clear all cells
        hasInitialized.current = true; // Prevent auto-initialization
        cellManager.clearAllCells(); // Use cellManager to clear cells

        // Add a single empty code cell after clearing
        setTimeout(() => {
          const cellId = cellManager.addCell('code', '', 'user');
        }, 100);
        return; // Exit early since we handle scrolling separately

      case '/run':
        // Run all cells
        cellManager.runAllCells();
        break;

      default:
        // If command not recognized, treat as markdown content
        newCellId = cellManager.addCell('markdown', command, 'user');
        break;
    }
  }, [cellManager, hasInitialized]);

  return { handleCommand };
} 