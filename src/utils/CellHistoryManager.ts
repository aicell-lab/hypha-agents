import { NotebookCell } from '../types/notebook';

interface CellHistoryState {
  cells: NotebookCell[];
  activeCellId: string | null;
}

export class CellHistoryManager {
  private undoStack: CellHistoryState[] = [];
  private redoStack: CellHistoryState[] = [];
  private clipboard: NotebookCell[] = [];
  private maxHistorySize = 50;

  // Save current state to undo stack
  pushState(cells: NotebookCell[], activeCellId: string | null) {
    // Create a deep copy of the cells to prevent reference issues
    const stateCopy: CellHistoryState = {
      cells: JSON.parse(JSON.stringify(cells)),
      activeCellId
    };

    // Add to undo stack
    this.undoStack.push(stateCopy);
    // Clear redo stack when new state is pushed
    this.redoStack = [];

    // Maintain history size limit
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  // Get the previous state from undo stack
  undo(): CellHistoryState | null {
    if (this.undoStack.length <= 1) return null; // Need at least 2 states to undo

    // Move current state to redo stack
    const currentState = this.undoStack.pop();
    if (currentState) {
      this.redoStack.push(currentState);
    }

    // Return the previous state (now the top of undo stack)
    return this.undoStack[this.undoStack.length - 1] || null;
  }

  // Get the next state from redo stack
  redo(): CellHistoryState | null {
    const nextState = this.redoStack.pop();
    if (!nextState) return null;

    // Add the state back to the undo stack
    this.undoStack.push(nextState);
    return nextState;
  }

  // Cut cells to clipboard
  cutCells(cells: NotebookCell[], selectedCellIds: string[]): NotebookCell[] | null {
    // Find the cells to cut
    const cellsToCut = cells.filter(cell => selectedCellIds.includes(cell.id));
    if (cellsToCut.length === 0) return null;

    // Store in clipboard
    this.clipboard = JSON.parse(JSON.stringify(cellsToCut));

    // Return remaining cells
    return cells.filter(cell => !selectedCellIds.includes(cell.id));
  }

  // Copy cells to clipboard
  copyCells(cells: NotebookCell[], selectedCellIds: string[]) {
    const cellsToCopy = cells.filter(cell => selectedCellIds.includes(cell.id));
    if (cellsToCopy.length > 0) {
      this.clipboard = JSON.parse(JSON.stringify(cellsToCopy));
    }
  }

  // Paste cells from clipboard
  pasteCells(cells: NotebookCell[], activeCellId: string | null): { newCells: NotebookCell[]; lastPastedId: string | null } {
    if (this.clipboard.length === 0) {
      return { newCells: cells, lastPastedId: null };
    }

    // Create new copies of clipboard cells with new IDs
    const newCells = this.clipboard.map(cell => ({
      ...JSON.parse(JSON.stringify(cell)),
      id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }));

    const lastPastedId = newCells[newCells.length - 1].id;

    let resultCells: NotebookCell[];
    if (!activeCellId) {
      // If no active cell, append to the end
      resultCells = [...cells, ...newCells];
    } else {
      // Find the index of the active cell and insert after it
      const activeIndex = cells.findIndex(cell => cell.id === activeCellId);
      if (activeIndex === -1) {
        resultCells = [...cells, ...newCells];
      } else {
        resultCells = [
          ...cells.slice(0, activeIndex + 1),
          ...newCells,
          ...cells.slice(activeIndex + 1)
        ];
      }
    }

    return { newCells: resultCells, lastPastedId };
  }

  // Check if undo is available
  canUndo(): boolean {
    return this.undoStack.length > 1; // Need at least 2 states to undo
  }

  // Check if redo is available
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Check if there's anything in the clipboard
  hasClipboardContent(): boolean {
    return this.clipboard.length > 0;
  }

  // Clear history
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  // Get current state without modifying stacks
  getCurrentState(): CellHistoryState | null {
    return this.undoStack[this.undoStack.length - 1] || null;
  }
} 