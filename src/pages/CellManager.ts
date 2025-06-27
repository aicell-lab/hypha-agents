import React from "react";
import { OutputItem } from "../types/notebook";
import Convert from "ansi-to-html";
import { v4 as uuidv4 } from 'uuid';
import localforage from 'localforage';
import { ChatMessage } from '../utils/chatCompletion';
import { CellHistoryManager } from '../utils/CellHistoryManager';
// REMOVE useProjects import
// import { useProjects } from '../providers/ProjectsProvider';

// Define different types of cells in our notebook
type CellType = 'markdown' | 'code' | 'thinking';
type ExecutionState = "idle" | "running" | "success" | "error";
type CellRole = "user" | "assistant" | "system";




const stripAnsi = (str: string) => {
    // This regex matches ANSI escape sequences
    return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
};

// Helper function to create shortened content for long outputs
// Function to create a short version of output content
const createShortContent = (content: string, type: string): string => {
    switch (type) {
      case 'stdout':
      case 'stderr':
      case 'execute_input':
        // For text content, use 128k limit
        const maxTextLength = 128 * 1024;
        if (content.length <= maxTextLength) return content;
        return `${stripAnsi(content.substring(0, maxTextLength))}... [truncated at 128k chars]`;
      
      case 'html':
        // For HTML, keep it short since it's usually not readable in chat context
        const maxHtmlLength = 1024;
        if (content.length <= maxHtmlLength) return content;
        return `[HTML content (${content.length} chars): ${content.substring(0, 200)}...]`;
      
      case 'img':
        // For images, just show metadata - no need for base64 data
        if (content.startsWith('data:image/')) {
          const mimeMatch = content.match(/data:(image\/[^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image';
          return `[Image: ${mimeType}, size: ${content.length} chars]`;
        }
        return `[Image content, size: ${content.length} chars]`;
      
      case 'svg':
        // For SVG, show a brief preview since it might contain readable content
        const maxSvgLength = 512;
        if (content.length <= maxSvgLength) return content;
        return `[SVG content (${content.length} chars): ${content.substring(0, 200)}...]`;
      
      default:
        // For other content types, check if it looks like base64 or binary
        if (content.match(/^[A-Za-z0-9+/]+=*$/) && content.length > 1000) {
          return `[Binary/Base64 content, size: ${content.length} chars]`;
        }
        
        // For regular text content, use 128k limit
        const maxDefaultLength = 128 * 1024;
        if (content.length <= maxDefaultLength) return content;
        return `${content.substring(0, maxDefaultLength)}... [truncated at 128k chars]`;
    }
  };
    

interface NotebookCell {
  id: string;
  type: CellType;
  content: string;
  executionCount?: number;
  executionState: ExecutionState;
  output?: OutputItem[];
  role?: CellRole;
  metadata?: {
    collapsed?: boolean;
    scrolled?: boolean;
    trusted?: boolean;
    isNew?: boolean;
    isEditing?: boolean;
    isCodeVisible?: boolean;
    isOutputVisible?: boolean;
    hasOutput?: boolean;
    userModified?: boolean;
    parent?: string; // ID of the parent cell (for tracking agent responses to user messages)
    staged?: boolean;
  };
}

interface NotebookMetadata {
  kernelspec: {
    name: string;
    display_name: string;
  };
  language_info: {
    name: string;
    version: string;
  };
  title: string; // Make title required
  created: string;
  modified: string;
}


export interface SavedState {
  cells: NotebookCell[];
  metadata: NotebookMetadata;
}

export interface StorageLocation {
  projectId?: string;  // If undefined, it's an in-browser file
  filePath: string;
}

// Cell Manager utility class to encapsulate cell operations
export class CellManager {
  cells: NotebookCell[];
  setCells: React.Dispatch<React.SetStateAction<NotebookCell[]>>;
  activeCellId: string | null;
  setActiveCellId: React.Dispatch<React.SetStateAction<string | null>>;
  executionCounter: number;
  setExecutionCounter: React.Dispatch<React.SetStateAction<number>>;
  editorRefs: React.MutableRefObject<{ [key: string]: React.RefObject<any> }>;
  notebookMetadata: NotebookMetadata;
  lastAgentCellRef: React.MutableRefObject<string | null>;
  executeCodeFn: any;
  historyManager: CellHistoryManager;
  // REMOVE file operation functions
  // private getFileContentFn: (projectId: string, filePath: string) => Promise<string>;
  // private uploadFileFn: (projectId: string, file: File) => Promise<void>;

  constructor(
    cells: NotebookCell[],
    setCells: React.Dispatch<React.SetStateAction<NotebookCell[]>>,
    activeCellId: string | null,
    setActiveCellId: React.Dispatch<React.SetStateAction<string | null>>,
    executionCounter: number,
    setExecutionCounter: React.Dispatch<React.SetStateAction<number>>,
    editorRefs: React.MutableRefObject<{ [key: string]: React.RefObject<any> }>,
    notebookMetadata: NotebookMetadata,
    lastAgentCellRef: React.MutableRefObject<string | null>,
    executeCodeFn: any,
    // REMOVE constructor arguments for file functions
    // getFileContentFn: (projectId: string, filePath: string) => Promise<string>,
    // uploadFileFn: (projectId: string, file: File) => Promise<void>
  ) {
    this.cells = cells;
    this.setCells = setCells;
    this.activeCellId = activeCellId;
    this.setActiveCellId = setActiveCellId;
    this.executionCounter = executionCounter;
    this.setExecutionCounter = setExecutionCounter;
    this.editorRefs = editorRefs;
    this.notebookMetadata = notebookMetadata;
    this.lastAgentCellRef = lastAgentCellRef;
    this.executeCodeFn = executeCodeFn;
    // REMOVE assignment of file functions
    // this.getFileContentFn = getFileContentFn;
    // this.uploadFileFn = uploadFileFn;
    this.historyManager = new CellHistoryManager();
  }

  // Generate a unique ID for cells
  generateId(): string {
    return uuidv4();
  }

  // Function to clear the 'running' state of any cells
  clearRunningState(): void {
    this.setCells((prev) =>
      prev.map((cell) =>
        cell.executionState === "running"
          ? { ...cell, executionState: "idle" }
          : cell
      )
    );
    console.log("[DEBUG] Cleared any lingering 'running' cell states.");
  }

  // Add a cell of specified type and content after a specific cell (or at the end)
  addCell(
    type: CellType,
    content: string = "",
    role?: CellRole | undefined,
    afterCellId?: string | undefined,
    parent?: string | undefined,
    insertIndex?: number,
    cellId?: string
  ): string {
    // Save state before adding cell
    this.saveState();
    
    const newCell: NotebookCell = {
      id: cellId || this.generateId(),
      type,
      content: content || "",
      executionState: "idle",
      role,
      metadata: {
        collapsed: false,
        trusted: true,
        isNew: type === "code",
        isEditing: false,
        isCodeVisible: true,
        isOutputVisible: true,
        parent: parent,
      },
    };

    // Create a ref for the new cell
    this.editorRefs.current[newCell.id] = React.createRef();

    this.setCells((prev) => {
      // If insertIndex is provided, use it
      if (
        typeof insertIndex === "number" &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        const newCells = [...prev];
        newCells.splice(insertIndex, 0, newCell);
        return newCells;
      }

      // If afterCellId is provided and exists, insert after that cell
      if (afterCellId) {
        const insertIndex = prev.findIndex((cell) => cell.id === afterCellId);
        if (insertIndex !== -1) {
          const newCells = [...prev];
          newCells.splice(insertIndex + 1, 0, newCell);
          return newCells;
        }
      }

      // If no afterCellId or not found, use activeCellId
      if (this.activeCellId) {
        const activeIndex = prev.findIndex(
          (cell) => cell.id === this.activeCellId
        );
        if (activeIndex !== -1) {
          const newCells = [...prev];
          newCells.splice(activeIndex + 1, 0, newCell);
          return newCells;
        }
      }

      // If no active cell or not found, append to the end
      return [...prev, newCell];
    });

    // Set the new cell as the active cell
    this.setActiveCellId(newCell.id);

    return newCell.id;
  }

  // Add a cell of specified type and content before a specific cell
  addCellBefore(
    type: CellType,
    content: string = "",
    role?: CellRole | undefined,
    beforeCellId?: string | undefined,
    parent?: string | undefined,
    insertIndex?: number
  ): string {
    // Save state before adding cell
    this.saveState();
    
    const newCell: NotebookCell = {
      id: this.generateId(),
      type,
      content: content || "",
      executionState: "idle",
      role,
      metadata: {
        collapsed: false,
        trusted: true,
        isNew: type === "code",
        isEditing: false,
        isCodeVisible: true,
        isOutputVisible: true,
        parent: parent,
      },
    };

    // Create a ref for the new cell
    this.editorRefs.current[newCell.id] = React.createRef();

    this.setCells((prev) => {
      // If insertIndex is provided, use it
      if (
        typeof insertIndex === "number" &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        const newCells = [...prev];
        newCells.splice(insertIndex, 0, newCell);
        return newCells;
      }

      // If beforeCellId is provided and exists, insert before that cell
      if (beforeCellId) {
        const insertIndex = prev.findIndex((cell) => cell.id === beforeCellId);
        if (insertIndex !== -1) {
          const newCells = [...prev];
          newCells.splice(insertIndex, 0, newCell);
          return newCells;
        }
      }

      // If beforeCellId not found or not provided, default to adding at the end
      return [...prev, newCell];
    });

    this.saveState();
    return newCell.id;
  }

  // Delete a cell by ID
  deleteCell(id: string): void {
    // Save state before deleting cell
    this.saveState();
    
    this.setCells((prev) => {
      const index = prev.findIndex((cell) => cell.id === id);
      if (index === -1) return prev;

      const newCells = prev.filter((cell) => cell.id !== id);

      // Update active cell if needed
      if (id === this.activeCellId) {
        // Try to activate the next cell, or the previous if there is no next
        const nextIndex = Math.min(index, newCells.length - 1);
        if (nextIndex >= 0) {
          const nextCell = newCells[nextIndex];
          this.setActiveCellId(nextCell.id);
          // Focus the newly activated cell
          setTimeout(() => {
            const editor = this.editorRefs.current[nextCell.id]?.current;
            if (editor) {
              if (nextCell.type === "code") {
                // For code cells, focus the Monaco editor
                if (typeof editor.focus === "function") {
                  editor.focus();
                } else if (editor.getContainerDomNode) {
                  editor.getContainerDomNode()?.focus();
                }
              } else {
                // For markdown cells, ensure it's in edit mode and focused
                this.toggleCellEditing(nextCell.id, false);
                if (typeof editor.focus === "function") {
                  editor.focus();
                } else if (editor.getContainerDomNode) {
                  editor.getContainerDomNode()?.focus();
                }
              }
            }
          }, 100);
        } else {
          this.setActiveCellId(null);
        }
      }

      this.saveState();
      return newCells;
    });
  }

  // Clear all cells and reset references
  clearAllCells(): void {
    this.setCells([]);
    this.setActiveCellId(null);
    this.editorRefs.current = {};
  }

  // Update cell content
  updateCellContent(id: string, content: string): void {
    // Save state before updating content
    this.saveState();
    
    this.setCells((prev) =>
      prev.map((cell) => (cell.id === id ? { ...cell, content } : cell))
    );
  }

  // Update cell execution state
  updateCellExecutionState(
    id: string,
    state: ExecutionState,
    outputs?: OutputItem[]
  ): void {
    this.setCells((prev) =>
      prev.map((cell) => {
        if (cell.id === id) {
          // Keep the current visibility states
          const isCodeVisible = cell.metadata?.isCodeVisible;
          const isOutputVisible = cell.metadata?.isOutputVisible;

          const updates: Partial<NotebookCell> = {
            executionState: state,
            metadata: {
              ...cell.metadata,
              isCodeVisible,
              isOutputVisible,
            },
          };

          if (state === "success" && cell.type === "code") {
            updates.executionCount = this.executionCounter;
            this.setExecutionCounter((prev) => prev + 1);
          }

          if (!outputs || outputs.length === 0) {
            updates.output = undefined;
          } else {
            const processedOutput = this.processOutputItems(outputs);
            updates.output = processedOutput;
          }

          return { ...cell, ...updates };
        }
        return cell;
      })
    );
    this.saveState();
  }

  // Process output items for ANSI codes
  processOutputItems(output: OutputItem[]): OutputItem[] {
    // Group stdout and stderr items
    let stdoutContent = '';
    let stderrContent = '';
    const otherItems: OutputItem[] = [];

    // First pass: collect and group items
    output.forEach((item) => {
      if (item.type === 'stdout') {
        stdoutContent += item.content;
      } else if (item.type === 'stderr' || item.type === 'error') {
        stderrContent += item.content;
      } else {
        otherItems.push(item);
      }
    });

    const processedItems: OutputItem[] = [];

    // Process stdout if exists
    if (stdoutContent) {
      // Split by newlines, filter empty lines, and rejoin
      const lines = stdoutContent.split('\n');
      const content = lines.join('\n');
      if (content) {
        processedItems.push({
          type: 'stdout',
          content,
          attrs: {
            className: 'output-area',
          },
        });
      }
    }

    // Process stderr if exists
    if (stderrContent) {
      try {
        processedItems.push({
          type: 'stderr',
          content: stripAnsi(stderrContent),
          attrs: {
            className: 'output-area error-output',
            isProcessedAnsi: true,
          },
        });
      } catch (error) {
        console.error("Error converting ANSI:", error);
        processedItems.push({
          type: 'stderr',
          content: stderrContent,
          attrs: {
            className: 'output-area error-output',
          },
        });
      }
    }

    // Add other items back
    return [...processedItems, ...otherItems.map(item => ({
      ...item,
      attrs: {
        ...item.attrs,
        className: `output-area ${item.attrs?.className || ''}`,
      },
    }))];
  }

  // Toggle cell editing mode
  toggleCellEditing(id: string, isEditing: boolean): void {
    this.setCells((prev) =>
      prev.map((cell) =>
        cell.id === id
          ? {
              ...cell,
              metadata: {
                ...cell.metadata,
                isEditing,
              },
            }
          : cell
      )
    );
  }

  // show the code of a cell
  showCode(id: string): void {
    this.setCells((prev) =>
      prev.map((cell) => (cell.id === id ? { ...cell, metadata: { ...cell.metadata, isCodeVisible: true } } : cell)
      )
    );
  }

  // hide the code of a cell
  hideCode(id: string): void {
    this.setCells((prev) =>
      prev.map((cell) => (cell.id === id ? { ...cell, metadata: { ...cell.metadata, isCodeVisible: false } } : cell)
      )
    );
  }

  // Toggle code visibility (for code cells)
  toggleCodeVisibility(id: string): void {
    this.setCells((prev) =>
      prev.map((cell) => {
        if (cell.id === id) {
          const currentVisibility = cell.metadata?.isCodeVisible !== false; // if undefined, treat as visible
          return {
            ...cell,
            metadata: {
              ...cell.metadata,
              isCodeVisible: !currentVisibility,
              userModified: true, // Mark that user has manually changed visibility
            },
          };
        }
        return cell;
      })
    );
  }

  // Show cell output
  showCellOutput(id: string): void {
    this.setCells((prev) =>
      prev.map((cell) => {
        if (cell.id === id) {
          return {
            ...cell,
            metadata: {
              ...cell.metadata,
              isOutputVisible: true,
              userModified: true, // Mark that user has manually changed visibility
            },
          };
        }
        return cell;
      })
    );
  }

  // Hide cell output
  hideCellOutput(id: string): void {
    this.setCells((prev) =>
      prev.map((cell) => {
        if (cell.id === id) {
          return {
            ...cell,
            metadata: {
              ...cell.metadata,
              isOutputVisible: false,
              userModified: true, // Mark that user has manually changed visibility
            },
          };
        }
        return cell;
      })
    );
  }

  // Toggle output visibility - updated to use show/hide methods
  toggleOutputVisibility(id: string): void {
    const cell = this.findCell((c) => c.id === id);
    if (!cell) return;

    const currentVisibility = cell.metadata?.isOutputVisible !== false; // if undefined, treat as visible
    if (currentVisibility) {
      this.hideCellOutput(id);
    } else {
      this.showCellOutput(id);
    }
  }

  // Set cell role
  updateCellRole(id: string, role: CellRole): void {
    this.setCells((prev) =>
      prev.map((cell) =>
        cell.id === id
          ? {
              ...cell,
              role,
            }
          : cell
      )
    );
  }

  // Change cell type
  changeCellType(id: string, newType: CellType): void {
    this.setCells((prev) =>
      prev.map((cell) => (cell.id === id ? { ...cell, type: newType } : cell))
    );
  }

  // Set active cell ID
  setActiveCell(id: string): void {
    // First set the activeCellId in state
    this.setActiveCellId(id);

    // No need to manually manipulate DOM classes as React will handle this
    // through the className prop based on activeCellId
  }

  // Move to next cell
  moveToNextCell(currentCellId: string): void {
    const currentIndex = this.cells.findIndex((c) => c.id === currentCellId);
    if (currentIndex === -1) return;

    if (currentIndex < this.cells.length - 1) {
      // Move to next existing cell
      const nextCell = this.cells[currentIndex + 1];
      this.setActiveCellId(nextCell.id);

      // Focus the cell
      this.focusCell(nextCell.id);

      // If it's a markdown cell, ensure it's not in edit mode
      if (nextCell.type === "markdown") {
        this.toggleCellEditing(nextCell.id, false);
      }
    } else {
      // Create and focus new cell at the end
      const newCellId = this.addCell("code", "", "user");
      this.setActiveCellId(newCellId);
      this.focusCell(newCellId);
    }
  }

  // Execute a cell
  async executeCell(
    id: string,
    shouldMoveFocus: boolean = false
  ): Promise<string> {
    const cell = this.cells.find((c) => c.id === id);
    if (!cell || cell.type !== "code" || !this.executeCodeFn) {
        throw new Error("Error: Cell not found or not a code cell");
    }

    // Get the current code from the editor ref
    const editorRef = this.editorRefs.current[id]?.current;
    const currentCode = editorRef?.getValue?.() || cell.content;

    // Update cell content first to ensure we're using the latest code
    this.updateCellContent(id, currentCode);

    // set output to be visible
    this.showCellOutput(id);

    // Update to running state
    this.updateCellExecutionState(id, "running");

    try {
      const outputs: OutputItem[] = [];
      let shortOutput = '';
      let fullOutput = '';
      const isSystemCell = cell.role === "system";
      
      await this.executeCodeFn(currentCode, {
        onOutput: (output: OutputItem) => {
          outputs.push(output);
          shortOutput += output.short_content + '\n';
          fullOutput += output.content + '\n';
          this.updateCellExecutionState(id, "running", outputs);
        },
        onStatus: (status: string) => {
          if (status === "Completed") {
            this.updateCellExecutionState(id, "success", outputs);
          } else if (status === "Error") {
            this.updateCellExecutionState(id, "error", outputs);
          }
        },
      });

      // If shouldMoveFocus is true, move to the next cell immediately before execution
      if (shouldMoveFocus) {
        this.moveToNextCell(id);
      }
      
      // For system cells, return full output; for regular cells, return short output
      const outputToReturn = isSystemCell ? fullOutput : shortOutput;
      return `[Cell Id: ${id}]\n${stripAnsi(outputToReturn.trim()) || "Code executed successfully."}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let content = errorMessage;
      let isProcessedAnsi = false;

      // Process ANSI codes in the error message
      if (errorMessage.includes("[0;") || errorMessage.includes("[1;")) {
        try {
          content = stripAnsi(errorMessage);
          isProcessedAnsi = true;
        } catch (e) {
          console.error("Error converting ANSI in error message:", e);
        }
      }

      this.updateCellExecutionState(id, "error", [
        {
          type: "stderr",
          content,
          attrs: {
            className: "output-area error-output",
            isProcessedAnsi,
          },
        },
      ]);
      return `[Cell Id: ${id}]\nError executing code: ${errorMessage}`;
    }
  }

  // Find cell by condition
  findCell(
    predicate: (cell: NotebookCell) => boolean
  ): NotebookCell | undefined {
    return this.cells.find(predicate);
  }

  // Find last cell by condition
  findLastCell(
    predicate: (cell: NotebookCell) => boolean
  ): NotebookCell | undefined {
    return this.cells.findLast(predicate);
  }

  // Filter cells by specific criteria
  filterCells(predicate: (cell: NotebookCell) => boolean): void {
    this.setCells((prev) => prev.filter(predicate));
  }

  // Get current state of cells with editor content
  getCurrentCellsContent(): NotebookCell[] {
    // First filter out thinking cells
    const nonThinkingCells = this.cells.filter(cell => cell.type !== 'thinking');
    
    return nonThinkingCells.map((cell) => {
      if (cell.type === "code") {
        // Get current content from editor ref if visible, otherwise use stored content
        const editorRef = this.editorRefs.current[cell.id];
        const currentContent =
          cell.metadata?.isCodeVisible === false
            ? cell.content // Use stored content if code is hidden
            : editorRef?.current?.getCurrentCode?.() || cell.content;

        return {
          ...cell,
          content: currentContent,
          output: cell.output, // Preserve the output array
          executionState: cell.executionState,
          executionCount: cell.executionCount,
          metadata: {
            ...cell.metadata,
            hasOutput: cell.output && cell.output.length > 0,
          },
        };
      }
      return cell;
    });
  }

  // Run all cells
  async runAllCells(): Promise<void> {
    for (const cell of this.cells) {
      if (cell.type === "code") {
        await this.executeCell(cell.id);
      }
    }
  }

  // Clear all outputs
  clearAllOutputs(): void {
    this.setCells((prev) =>
      prev.map((cell) => ({
        ...cell,
        output: undefined,
        executionState: "idle",
      }))
    );
  }

  // Collapse code cell - directly control visibility
  collapseCodeCell(cellId: string): void {
    this.setCells((prev) =>
      prev.map((cell) =>
        cell.id === cellId
          ? {
              ...cell,
              metadata: {
                ...cell.metadata,
                isCodeVisible: false, // Directly hide code editor but show output
              },
            }
          : cell
      )
    );
    console.log("[DEBUG] Collapsed code cell:", cellId);
  }

  // Get the current agent cell reference
  getCurrentAgentCell(): string | undefined {
    return this.lastAgentCellRef.current || undefined;
  }

  // Set the current agent cell reference
  setCurrentAgentCell(cellId: string | null) {
    this.lastAgentCellRef.current = cellId;
  }

  // Clear the current agent cell reference
  clearCurrentAgentCell() {
    this.lastAgentCellRef.current = null;
  }

  // Get the parent ID for a cell
  getCellParentId(cellId: string): string | undefined {
    const cell = this.findCell((c) => c.id === cellId);
    return cell?.metadata?.parent;
  }

  // Get the parent cell for a cell
  getParentCell(cellId: string): NotebookCell | undefined {
    const parentId = this.getCellParentId(cellId);
    if (!parentId) return undefined;
    return this.findCell((c) => c.id === parentId);
  }

  // Find all children cells of a given cell ID
  findChildrenCells(parentId: string | undefined): NotebookCell[] {
    if (!parentId) return [];
    return this.cells.filter((cell) => cell.metadata?.parent === parentId);
  }

  // Get IDs of all children cells of a given cell ID
  getCellChildrenIds(parentId: string | undefined): string[] {
    return this.findChildrenCells(parentId).map(cell => cell.id);
  }

  // Add public method to scroll a cell into view
  scrollCellIntoView(cellId: string, timeout: number = 0): void {
    setTimeout(() => {
      const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, timeout);
  }

  // Helper method to focus a cell
  private focusCell(cellId: string): void {
    const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
    if (cellElement) {
      // Use the new scrollCellIntoView method with a small delay
      this.scrollCellIntoView(cellId, 100);

      const editor = this.editorRefs.current[cellId]?.current;
      if (editor) {
        if (typeof editor.focus === "function") {
          editor.focus();
        } else if (editor.getContainerDomNode) {
          const editorNode = editor.getContainerDomNode();
          if (editorNode) {
            editorNode.focus();
            // Try to focus the actual editor input
            const cell = this.findCell((c) => c.id === cellId);
            const inputSelector =
              cell?.type === "code" ? ".monaco-editor textarea" : "textarea";
            const inputElement = editorNode.querySelector(inputSelector);
            if (inputElement) {
              (inputElement as HTMLTextAreaElement).focus();
            }
          }
        }
      }
    }
  }

  // Delete a cell and its children
  deleteCellWithChildren(cellId: string): void {
    // Save state before deleting cells
    this.saveState();
    
    // Find the cell and its children
    const cell = this.findCell((c) => c.id === cellId);
    if (!cell) return;

    // Get all cells that have this cell as their parent
    const childrenCells = this.findChildrenCells(cellId);
    const childrenIds = childrenCells.map((cell) => cell.id);

    // Add the parent cell ID to the list of cells to delete
    const allIdsToDelete = [cellId, ...childrenIds];

    // Delete all cells at once
    this.setCells((prev) => {
      const newCells = prev.filter((cell) => !allIdsToDelete.includes(cell.id));

      // Update active cell if needed
      if (allIdsToDelete.includes(this.activeCellId || "")) {
        // Find the index of the last deleted cell
        const lastDeletedIndex = prev.findIndex((cell) => cell.id === cellId);
        if (lastDeletedIndex !== -1) {
          // Try to get the next cell after deletion, or the previous if at the end
          const nextIndex = Math.min(lastDeletedIndex, newCells.length - 1);
          if (nextIndex >= 0) {
            const nextCell = newCells[nextIndex];
            this.setActiveCellId(nextCell.id);

            // If it's a markdown cell, ensure it's in edit mode
            if (nextCell.type === "markdown") {
              this.toggleCellEditing(nextCell.id, false);
            }

            // Focus the newly activated cell
            this.focusCell(nextCell.id);
          } else {
            this.setActiveCellId(null);
          }
        }
      }

      // Clean up editor refs for deleted cells
      allIdsToDelete.forEach((cellId) => {
        if (this.editorRefs.current[cellId]) {
          delete this.editorRefs.current[cellId];
        }
      });

      this.saveState();
      return newCells;
    });
  }

  // Regenerate agent responses for a user message cell
  regenerateResponses(
    userCellId: string
  ): { messageToRegenerate: string; thinkingCellId: string } | void {
    // Find the user message cell
    const userCell = this.findCell((cell) => cell.id === userCellId);
    if (!userCell || userCell.role !== "user") {
      console.error(
        "[DEBUG] Cannot regenerate responses for a non-user cell or cell not found"
      );
      return;
    }

    // Get the message content
    const messageContent = userCell.content;

    // Find all children cells (responses from the agent for this user message)
    const childrenCells = this.findChildrenCells(userCellId);
    const childrenIds = childrenCells.map((cell) => cell.id);

    // Remove all children cells first
    this.setCells((prev) =>
      prev.filter((cell) => !childrenIds.includes(cell.id))
    );

    // Clean up editor refs for deleted cells
    childrenIds.forEach((cellId) => {
      if (this.editorRefs.current[cellId]) {
        delete this.editorRefs.current[cellId];
      }
    });

    // Add a thinking cell right after the user's message
    const thinkingCellId = this.addCell(
      "markdown",
      "🤔 Thinking...",
      "assistant",
      userCellId,
      userCellId
    );

    // Set the thinking cell reference for anchoring responses
    this.setCurrentAgentCell(thinkingCellId);


    // Signal that we want to regenerate a response
    return {
      messageToRegenerate: messageContent,
      thinkingCellId,
    };
  }

  // Add helper method to find the last cell of a conversation group
  findLastCellOfConversation(cellId: string): string {
    // If cell has no parent
    const activeCell = this.findCell((c) => c.id === cellId);
    if (!activeCell) return cellId;

    // If cell has a parent, find all cells with the same parent
    const parentId = activeCell.metadata?.parent;
    if (parentId) {
      const allSiblings = this.findChildrenCells(parentId);

      // Include the parent cell in consideration
      const parentCell = this.findCell((c) => c.id === parentId);
      const conversationCells = [parentCell, ...allSiblings].filter(
        (cell): cell is NotebookCell => cell !== undefined
      );

      // Sort cells by their position in the notebook
      const sortedCells = conversationCells.sort((a, b) => {
        const indexA = this.cells.findIndex((c) => c.id === a.id);
        const indexB = this.cells.findIndex((c) => c.id === b.id);
        return indexA - indexB;
      });

      // Return the ID of the last cell
      if (sortedCells.length > 0) {
        return sortedCells[sortedCells.length - 1].id;
      }
    }

    // If no parent or no siblings found, return the original cell ID
    return cellId;
  }

  // Find the cell ID before a reference cell
  findCellIdBefore(referenceCellId: string): string | null {
    const cellIndex = this.cells.findIndex(
      (cell) => cell.id === referenceCellId
    );
    if (cellIndex > 0) {
      return this.cells[cellIndex - 1].id;
    }
    return null;
  }

  // Find the cell ID after a reference cell
  findCellIdAfter(referenceCellId: string): string | null {
    const cellIndex = this.cells.findIndex(
      (cell) => cell.id === referenceCellId
    );
    if (cellIndex !== -1 && cellIndex < this.cells.length - 1) {
      return this.cells[cellIndex + 1].id;
    }
    return null;
  }

  // Get the active cell ID or its last child cell ID
  getActiveCellWithChildren(): string | null {
    if (!this.activeCellId) return null;

    // Get all children cells of the active cell
    const childrenCells = this.findChildrenCells(this.activeCellId);

    if (childrenCells.length === 0) {
      // If no children, return the active cell ID
      return this.activeCellId;
    }

    // Find the last child by its position in the cells array
    const lastChild = childrenCells.reduce((latest, current) => {
      const latestIndex = this.cells.findIndex((cell) => cell.id === latest.id);
      const currentIndex = this.cells.findIndex(
        (cell) => cell.id === current.id
      );
      return currentIndex > latestIndex ? current : latest;
    });

    return lastChild.id;
  }

  // Update or create a cell by ID
  updateCellById(
    cellId: string,
    content: string,
    type: CellType = "markdown",
    role: CellRole = "assistant",
    parent?: string
  ): void {
    // Use a single setCells call to make the update atomic
    this.setCells((prev) => {
      // Check if cell exists in the current state
      const existingCell = prev.find((c) => c.id === cellId);

      if (existingCell) {
        // Update existing cell
        return prev.map((cell) =>
          cell.id === cellId
            ? {
                ...cell,
                type, // Update the type as well
                content,
                metadata: {
                  ...cell.metadata,
                  isEditing: false,
                  parent,
                },
              }
            : cell
        );
      } else {
        // Check if we're already in the process of creating this cell
        const isBeingCreated = prev.some((cell) => cell.id === cellId);
        if (isBeingCreated) {
          // If the cell is being created, just update its content
          return prev.map((cell) =>
            cell.id === cellId
              ? {
                  ...cell,
                  content,
                  metadata: {
                    ...cell.metadata,
                    isEditing: false,
                    parent,
                  },
                }
              : cell
          );
        }

        // Get current agent cell and parent cell for positioning
        const currentAgentCell = this.getCurrentAgentCell();
        const parentCell = parent
          ? prev.find((cell) => cell.id === parent)
          : null;

        // Find the index where we should insert the new cell
        let insertIndex;
        if (parentCell) {
          // Find all cells that share the same parent
          const siblingCells = prev.filter(
            (cell) => cell.metadata?.parent === parent
          );
          if (siblingCells.length > 0) {
            // Find the last sibling cell's index
            const lastSiblingId = siblingCells[siblingCells.length - 1].id;
            insertIndex =
              prev.findIndex((cell) => cell.id === lastSiblingId) + 1;
          } else {
            // If no siblings, insert after the parent
            insertIndex = prev.findIndex((cell) => cell.id === parent) + 1;
          }
        } else if (currentAgentCell) {
          // If no parent but we have a current agent cell, insert after it
          insertIndex =
            prev.findIndex((cell) => cell.id === currentAgentCell) + 1;
        } else {
          // If no parent and no current agent cell, append to the end
          insertIndex = prev.length;
        }

        // Create new cell
        const newCell: NotebookCell = {
          id: cellId,
          type,
          content,
          executionState: "idle",
          role,
          metadata: {
            collapsed: false,
            trusted: true,
            isNew: type === "code",
            isEditing: false,
            isCodeVisible: true,
            isOutputVisible: true,
            parent: parent,
          },
        };

        // Create a ref for the new cell
        this.editorRefs.current[cellId] = React.createRef();

        // Insert the new cell at the correct position
        const newCells = [...prev];
        newCells.splice(insertIndex, 0, newCell);

        // Update the current agent cell reference
        this.lastAgentCellRef.current = cellId;

        this.saveState();
        return newCells;
      }
    });
  }

  // Update cell metadata
  updateCellMetadata(cellId: string, metadata: NotebookCell["metadata"]): void {
    this.setCells((prev) =>
      prev.map((cell) =>
        cell.id === cellId
          ? {
              ...cell,
              metadata: {
                ...cell.metadata,
                ...metadata,
              },
            }
          : cell
      )
    );
  }

  // Function to convert notebook cells to chat history
  convertCellsToHistory(
    cells: NotebookCell[]
  ): Array<{ role: string; content: string }> {
    const history: Array<{ role: string; content: string }> = [];

    for (const cell of cells) {
      // Skip cells without a role (they're not part of the conversation)
      if (!cell.role) continue;
      
      // Skip cells that are marked as staged
      if (cell.metadata?.staged === true) continue;

      if (cell.type === "markdown") {
        history.push({
          role: cell.role,
          content: cell.content,
        });
      } else if (cell.type === "code") {
        let content = "";
        
        // For system cells, only include the output
        if (cell.role === "system") {
          if (cell.output && cell.output.length > 0) {
            content = "";
            for (const output of cell.output) {
              switch (output.type) {
                case "stdout":
                case "stderr":
                  // For system cells, use full content without truncation
                  content += `${
                    output.type === "stderr" ? "Error: " : ""
                  }${output.content}\n`;
                  break;
                case "html":
                  content += "[HTML Output]\n";
                  break;
                case "img":
                  content += "[Image Output]\n";
                  break;
                case "svg":
                  content += "[SVG Output]\n";
                  break;
                default:
                  if (output.content) {
                    // For system cells, use full content without truncation
                    content += `${output.content}\n`;
                  }
              }
            }
          }
          history.push({
            role: cell.role,
            content: content.trim(),
          });
        } else {
          // For non-system cells, include both code and output
          content = `<py-script>${cell.content}</py-script>`;
          history.push({
            role: cell.role,
            content: content.trim(),
          });
          // Add outputs if they exist
          if (cell.output && cell.output.length > 0) {
            content = "\n<observation>\n";
            for (const output of cell.output) {
              switch (output.type) {
                case "stdout":
                case "stderr":
                  const shortContent = createShortContent(
                    output.content,
                    output.type
                  );
                  content += `${
                    output.type === "stderr" ? "Error: " : ""
                  }${shortContent}\n`;
                  break;
                case "html":
                  content += "[HTML Output]\n";
                  break;
                case "img":
                  content += "[Image Output]\n";
                  break;
                case "svg":
                  content += "[SVG Output]\n";
                  break;
                default:
                  if (output.content) {
                    const shortContent = createShortContent(
                      output.content,
                      "text"
                    );
                    content += `${shortContent}\n`;
                  }
              }
            }
            content += "\n</observation>\n";
            history.push({
                role: "user",
                content: content.trim(),
            });
          }
        }

       
      }
    }

    return history;
  }

  // Toggle the commit status of a cell (staged vs. committed)
  toggleCellCommitStatus(id: string): void {
    this.setCells((prev) =>
      prev.map((cell) => {
        if (cell.id === id && cell.metadata) {
          const newStagedStatus = !cell.metadata.staged;
          return {
            ...cell,
            metadata: {
              ...cell.metadata,
              staged: newStagedStatus,
              isOutputVisible: !newStagedStatus, // Output visible only if committed
              userModified: true, // Mark that user manually changed status
            },
          };
        }
        return cell;
      })
    );
    console.log(`[DEBUG] Toggled commit status for cell ${id}`);
  }

  moveCellUp(cellId: string): boolean {
    const cellIndex = this.cells.findIndex(cell => cell.id === cellId);
    if (cellIndex <= 0) return false; // Can't move first cell up

    const cell = this.cells[cellIndex];
    const parentId = cell.metadata?.parent;

    if (parentId) {
      // For child cells, only allow movement within siblings
      const siblings = this.findChildrenCells(parentId);
      const siblingIndex = siblings.findIndex(c => c.id === cellId);
      if (siblingIndex <= 0) return false; // Already first sibling

      // Find the actual indices in the main cells array
      const prevSiblingId = siblings[siblingIndex - 1].id;
      const prevSiblingIndex = this.cells.findIndex(c => c.id === prevSiblingId);

      // Swap the cells
      const updatedCells = [...this.cells];
      [updatedCells[prevSiblingIndex], updatedCells[cellIndex]] = [updatedCells[cellIndex], updatedCells[prevSiblingIndex]];
      
      this.setCells(updatedCells);
      return true;
    } else {
      // For parent cells, move with all children
      const childrenCells = this.findChildrenCells(cellId);
      const allCellsToMove = [cell, ...childrenCells];
      const cellsToMoveIds = new Set(allCellsToMove.map(c => c.id));

      // Find the first cell in our moving group
      const firstMovingCellIndex = cellIndex;
      
      // Find the previous cell before our group that's not part of what we're moving
      let prevCellIndex = firstMovingCellIndex - 1;
      while (prevCellIndex >= 0 && cellsToMoveIds.has(this.cells[prevCellIndex].id)) {
        prevCellIndex--;
      }
      if (prevCellIndex < 0) return false;

      // Find the target position to insert our group
      let targetInsertIndex = prevCellIndex;
      const prevCell = this.cells[prevCellIndex];

      if (!prevCell.metadata?.parent) {
        // Previous cell is a parent, move before it
        targetInsertIndex = prevCellIndex;
      } else {
        // Previous cell is a child, find its parent and move before the parent
        const prevCellParentId = prevCell.metadata.parent;
        if (prevCellParentId) {
          const parentIndex = this.cells.findIndex(c => c.id === prevCellParentId);
          if (parentIndex !== -1) {
            targetInsertIndex = parentIndex;
          }
        }
      }

      // Create new array without the cells we're moving
      const remainingCells = this.cells.filter(c => !cellsToMoveIds.has(c.id));
      
      // Insert the moving group at the calculated position
      remainingCells.splice(targetInsertIndex, 0, ...allCellsToMove);
      
      this.setCells(remainingCells);
      return true;
    }
  }

  moveCellDown(cellId: string): boolean {
    const cellIndex = this.cells.findIndex(cell => cell.id === cellId);
    if (cellIndex === -1 || cellIndex >= this.cells.length - 1) return false;

    const cell = this.cells[cellIndex];
    const parentId = cell.metadata?.parent;

    if (parentId) {
      // For child cells, only allow movement within siblings
      const siblings = this.findChildrenCells(parentId);
      const siblingIndex = siblings.findIndex(c => c.id === cellId);
      if (siblingIndex === siblings.length - 1) return false; // Already last sibling

      // Find the actual indices in the main cells array
      const nextSiblingId = siblings[siblingIndex + 1].id;
      const nextSiblingIndex = this.cells.findIndex(c => c.id === nextSiblingId);

      // Swap the cells
      const updatedCells = [...this.cells];
      [updatedCells[cellIndex], updatedCells[nextSiblingIndex]] = [updatedCells[nextSiblingIndex], updatedCells[cellIndex]];
      
      this.setCells(updatedCells);
      return true;
    } else {
      // For parent cells, move with all children
      const childrenCells = this.findChildrenCells(cellId);
      const allCellsToMove = [cell, ...childrenCells];
      const allCellsToMoveIds = new Set(allCellsToMove.map(c => c.id));

      // Find the last cell in our moving group
      const lastMovingCellIndex = cellIndex + childrenCells.length;
      
      // Find the next cell after our group that's not part of what we're moving
      let nextCellIndex = lastMovingCellIndex + 1;
      while (nextCellIndex < this.cells.length && allCellsToMoveIds.has(this.cells[nextCellIndex].id)) {
        nextCellIndex++;
      }
      if (nextCellIndex >= this.cells.length) return false;

      // Find the target position to insert our group
      let targetInsertIndex = nextCellIndex + 1;
      const nextCell = this.cells[nextCellIndex];

      if (!nextCell.metadata?.parent) {
        // Next cell is a parent, move after its children
        const nextCellChildren = this.findChildrenCells(nextCell.id);
        if (nextCellChildren.length > 0) {
          // Move after the last child of the next parent
          const lastChildId = nextCellChildren[nextCellChildren.length - 1].id;
          targetInsertIndex = this.cells.findIndex(c => c.id === lastChildId) + 1;
        } else {
          // Move after the next parent cell
          targetInsertIndex = nextCellIndex + 1;
        }
      }

      // Create new array without the cells we're moving
      const remainingCells = this.cells.filter(c => !allCellsToMoveIds.has(c.id));
      
      // Insert the moving group at the calculated position
      remainingCells.splice(targetInsertIndex - allCellsToMove.length, 0, ...allCellsToMove);
      
      this.setCells(remainingCells);
      return true;
    }
  }

  // Add method to save current state
  private saveState() {
    this.historyManager.pushState(this.cells, this.activeCellId);
  }

  // Add undo/redo methods
  undo() {
    const previousState = this.historyManager.undo();
    if (previousState) {
      // Apply the previous state
      this.setCells(previousState.cells);
      this.setActiveCellId(previousState.activeCellId);
      return true;
    }
    return false;
  }

  redo() {
    const nextState = this.historyManager.redo();
    if (nextState) {
      // Apply the next state
      this.setCells(nextState.cells);
      this.setActiveCellId(nextState.activeCellId);
      return true;
    }
    return false;
  }

  // Add cut/copy/paste methods
  cutCells(selectedCellIds: string[]) {
    const remainingCells = this.historyManager.cutCells(this.cells, selectedCellIds);
    if (remainingCells) {
      // Save state before making changes
      this.saveState();
      this.setCells(remainingCells);
      // Set active cell to the one after the cut cells, or the last cell
      const lastCutIndex = Math.max(...selectedCellIds.map(id => 
        this.cells.findIndex(cell => cell.id === id)
      ));
      const nextCell = remainingCells[lastCutIndex] || remainingCells[remainingCells.length - 1];
      if (nextCell) {
        this.setActiveCellId(nextCell.id);
      }
    }
  }

  copyCells(selectedCellIds: string[]) {
    this.historyManager.copyCells(this.cells, selectedCellIds);
  }

  pasteCells() {
    // Save state before pasting
    this.saveState();
    
    const result = this.historyManager.pasteCells(this.cells, this.activeCellId);
    if (result.newCells !== this.cells) {
      this.setCells(result.newCells);
      
      // Make the last pasted cell active
      if (result.lastPastedId) {
        this.setActiveCellId(result.lastPastedId);
        // Focus the newly activated cell
        this.focusCell(result.lastPastedId);
      }
    }
  }

  // Add state check methods
  canUndo(): boolean {
    return this.historyManager.canUndo();
  }

  canRedo(): boolean {
    return this.historyManager.canRedo();
  }

  hasClipboardContent(): boolean {
    return this.historyManager.hasClipboardContent();
  }

  // Add method to clear history
  clearHistory() {
    this.historyManager.clearHistory();
  }
}
