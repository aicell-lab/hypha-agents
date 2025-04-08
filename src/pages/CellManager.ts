import React from "react";
import { OutputItem } from "../components/chat/Chat";
import Convert from "ansi-to-html";
import { v4 as uuidv4 } from 'uuid';
import localforage from 'localforage';
// Define different types of cells in our notebook
type CellType = 'markdown' | 'code' | 'thinking';
type ExecutionState = "idle" | "running" | "success" | "error";
type CellRole = "user" | "assistant" | "system";

// Create convert instance
const convert = new Convert({
  fg: '#000',
  bg: '#fff',
  newline: true,
  escapeXML: true,
  stream: false
});

// Configure localforage
localforage.config({
  name: 'notebook_storage',
  storeName: 'notebooks',
  description: 'Storage for notebook cells and metadata'
});

const stripAnsi = (str: string) => {
    // This regex matches ANSI escape sequences
    return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
};

// Helper function to create shortened content for long outputs
// Function to create a short version of output content
const createShortContent = (content: string, type: string): string => {
    const maxLength = 4096;
  
    if (content.length <= maxLength) return content;
    
    switch (type) {
      case 'stdout':
      case 'stderr':
        return `${stripAnsi(content.substring(0, maxLength))}...`;
      case 'html':
        return `[HTML content truncated...]`;
      case 'img':
        return `[Image content truncated...]`;
      case 'svg':
        return `[SVG content truncated...]`;
      default:
        return `${content.substring(0, maxLength)}...`;
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
    role?: CellRole;
    isEditing?: boolean;
    isCodeVisible?: boolean;
    isOutputVisible?: boolean;
    hasOutput?: boolean;
    userModified?: boolean;
    parent?: string; // ID of the parent cell (for tracking agent responses to user messages)
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

// Interface for stored notebook data
interface StoredNotebookData {
  cells: NotebookCell[];
  metadata: NotebookMetadata;
}

// Storage key constant
const STORAGE_KEY = "notebook_state";

// Helper to safely stringify notebook state
const safeStringify = (data: any) => {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error("Error stringifying notebook data:", error);
    return null;
  }
};

// Helper to safely parse notebook state
const safeParse = (str: string | null) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error("Error parsing notebook data:", error);
    return null;
  }
};

// Helper to save notebook state using localforage
const saveToLocalStorage = async (
  cells: NotebookCell[],
  metadata: NotebookMetadata
) => {
  const data: StoredNotebookData = {
    cells: cells.map((cell) => ({
      ...cell,
      output: cell.output
        ? cell.output.map((output) => ({
            ...output,
            attrs: {
              ...output.attrs,
              className: undefined, // Remove className as it's UI-specific
            },
          }))
        : undefined,
      metadata: {
        ...cell.metadata,
        hasOutput: cell.output && cell.output.length > 0,
        parent: cell.metadata?.parent, // Explicitly preserve parent key
      },
    })),
    metadata: {
      ...metadata,
      modified: new Date().toISOString(),
    },
  };

  try {
    await localforage.setItem(STORAGE_KEY, data);
    console.log("[DEBUG] Saved notebook with cells:", cells.length);
  } catch (error) {
    console.error("Error saving to localforage:", error);
  }
};

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
    executeCodeFn: any
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
  }

  // Generate a unique ID for cells
  generateId(): string {
    return uuidv4();
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
        role: role,
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
        role: role,
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

    return newCell.id;
  }

  // Delete a cell by ID
  deleteCell(id: string): void {
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
        const htmlContent = convert.toHtml(stderrContent);
        processedItems.push({
          type: 'stderr',
          content: htmlContent,
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
              metadata: { ...cell.metadata, role },
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
      await this.executeCodeFn(currentCode, {
        onOutput: (output: OutputItem) => {
          outputs.push(output);
          shortOutput += output.short_content + '\n';
          this.updateCellExecutionState(id, "running", outputs);
        },
        onStatus: (status: string) => {
          if (status === "Completed") {
            this.updateCellExecutionState(id, "success", outputs);
            // Save to localStorage after successful execution
            setTimeout(() => {
                this.saveToLocalStorage();
              }, 100);
          } else if (status === "Error") {
            this.updateCellExecutionState(id, "error", outputs);
            // Save to localStorage after error
            setTimeout(() => {
                this.saveToLocalStorage();
              }, 100);
          }
        },
      });

          // If shouldMoveFocus is true, move to the next cell immediately before execution
        if (shouldMoveFocus) {
        this.moveToNextCell(id);
      }
      return `[Cell Id: ${id}]\n${stripAnsi(shortOutput.trim()) || "Code executed successfully."}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let content = errorMessage;
      let isProcessedAnsi = false;

      // Process ANSI codes in the error message
      if (errorMessage.includes("[0;") || errorMessage.includes("[1;")) {
        try {
          const htmlContent = convert.toHtml(errorMessage);
          content = htmlContent;
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
    return this.cells.map((cell) => {
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

  // Save to localStorage
  async saveToLocalStorage(): Promise<void> {
    const currentCells = this.getCurrentCellsContent();
    console.log(
      "[DEBUG] Auto-saving notebook with cells:",
      currentCells.length
    );
    await saveToLocalStorage(currentCells, this.notebookMetadata);
  }

  // Helper to load notebook state from localStorage
  async loadFromLocalStorage(): Promise<{
    cells: NotebookCell[];
    metadata: NotebookMetadata;
  } | null> {
    try {
      const data = await localforage.getItem<StoredNotebookData>(STORAGE_KEY);
      if (!data) return null;

      // Ensure we have valid cells array and metadata
      if (!Array.isArray(data.cells)) return null;
      if (!data.metadata || typeof data.metadata !== "object") return null;

      return {
        cells: data.cells.map((cell: NotebookCell) => ({
          ...cell,
          id: uuidv4(), // Generate new ID
          executionState: "idle",
          output: cell.output
            ? cell.output.map((output: OutputItem) => ({
                ...output,
                attrs: {
                  ...output.attrs,
                  className: `output-area ${
                    output.type === "stderr" ? "error-output" : ""
                  }`,
                },
              }))
            : undefined,
          metadata: {
            ...cell.metadata,
            isNew: false,
            parent: cell.metadata?.parent, // Explicitly preserve parent key
          },
        })),
        metadata: data.metadata,
      };
    } catch (error) {
      console.error("Error loading from localforage:", error);
      return null;
    }
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

  // Helper method to focus a cell
  private focusCell(cellId: string): void {
    const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
    if (cellElement) {
      cellElement.scrollIntoView({ behavior: "smooth", block: "center" });

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

    // Scroll to the thinking message
    const cellElement = document.querySelector(
      `[data-cell-id="${thinkingCellId}"]`
    );
    if (cellElement) {
      cellElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }

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
            role: role,
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
          }
          history.push({
            role: cell.role,
            content: content.trim(),
          });
        } else {
          // For non-system cells, include both code and output
          content = `<python>${cell.content}</python>`;
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
}
