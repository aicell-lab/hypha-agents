import React from 'react';
import { OutputItem } from '../components/chat/Chat';
import Convert from 'ansi-to-html';
// Define different types of cells in our notebook
type CellType = 'markdown' | 'code';
type ExecutionState = 'idle' | 'running' | 'success' | 'error';
type CellRole = 'user' | 'assistant' | 'system';

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


// Add localStorage constants and helpers
const STORAGE_KEY = 'notebook_state';

// Helper to safely stringify notebook state
const safeStringify = (data: any) => {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error('Error stringifying notebook data:', error);
    return null;
  }
};

// Helper to save notebook state to localStorage
const saveToLocalStorage = (cells: NotebookCell[], metadata: NotebookMetadata) => {
  const data = safeStringify({
    cells: cells.map(cell => ({
      ...cell,
      output: cell.output ? cell.output.map(output => ({
        ...output,
        attrs: {
          ...output.attrs,
          className: undefined // Remove className as it's UI-specific
        }
      })) : undefined,
      metadata: {
        ...cell.metadata,
        hasOutput: cell.output && cell.output.length > 0,
        parent: cell.metadata?.parent // Explicitly preserve parent key
      }
    })),
    metadata: {
      ...metadata,
      modified: new Date().toISOString()
    }
  });
  
  if (data) {
    try {
      localStorage.setItem(STORAGE_KEY, data);
      console.log('[DEBUG] Saved notebook with cells:', cells.length);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
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
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  // Add a cell of specified type and content after a specific cell (or at the end)
  addCell(
    type: CellType, 
    content: string = '', 
    role?: CellRole | undefined, 
    afterCellId?: string | undefined,
    parent?: string | undefined
  ): string {
    const newCell: NotebookCell = {
      id: this.generateId(),
      type,
      content: content || "",
      executionState: 'idle',
      role,
      metadata: {
        collapsed: false,
        trusted: true,
        isNew: type === 'code',
        role: role,
        isEditing: false,
        isCodeVisible: true,
        parent: parent
      }
    };
    
    // Create a ref for the new cell
    this.editorRefs.current[newCell.id] = React.createRef();
    
    this.setCells(prev => {
      // If afterCellId is provided and exists, insert after that cell
      if (afterCellId) {
        const insertIndex = prev.findIndex(cell => cell.id === afterCellId);
        if (insertIndex !== -1) {
          const newCells = [...prev];
          newCells.splice(insertIndex + 1, 0, newCell);
          return newCells;
        }
      }
      
      // If no afterCellId or not found, use activeCellId
      if (this.activeCellId) {
        const activeIndex = prev.findIndex(cell => cell.id === this.activeCellId);
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
    content: string = '', 
    role?: CellRole | undefined, 
    beforeCellId?: string | undefined,
    parent?: string | undefined
  ): string {
    const newCell: NotebookCell = {
      id: this.generateId(),
      type,
      content: content || "",
      executionState: 'idle',
      role,
      metadata: {
        collapsed: false,
        trusted: true,
        isNew: type === 'code',
        role: role,
        isEditing: false,
        isCodeVisible: true,
        parent: parent
      }
    };
    
    // Create a ref for the new cell
    this.editorRefs.current[newCell.id] = React.createRef();
    
    this.setCells(prev => {
      // If beforeCellId is provided and exists, insert before that cell
      if (beforeCellId) {
        const insertIndex = prev.findIndex(cell => cell.id === beforeCellId);
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
    this.setCells(prev => {
      const index = prev.findIndex(cell => cell.id === id);
      if (index === -1) return prev;

      const newCells = prev.filter(cell => cell.id !== id);
      
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
              if (nextCell.type === 'code') {
                // For code cells, focus the Monaco editor
                if (typeof editor.focus === 'function') {
                  editor.focus();
                } else if (editor.getContainerDomNode) {
                  editor.getContainerDomNode()?.focus();
                }
              } else {
                // For markdown cells, ensure it's in edit mode and focused
                this.toggleCellEditing(nextCell.id, true);
                if (typeof editor.focus === 'function') {
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
    this.setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { ...cell, content } : cell
      )
    );
  }
  
  // Update cell execution state
  updateCellExecutionState(id: string, state: ExecutionState, output?: OutputItem[]): void {
    this.setCells(prev => 
      prev.map(cell => {
        if (cell.id === id) {
          // Only make code visible during execution
          let isCodeVisible = cell.metadata?.isCodeVisible;
          
          // If in running state, always show the code (expanded)
          if (state === 'running') {
            isCodeVisible = true;
          }

          const updates: Partial<NotebookCell> = { 
            executionState: state,
            metadata: {
              ...cell.metadata,
              isCodeVisible
            }
          };
          
          if (state === 'success' && cell.type === 'code') {
            updates.executionCount = this.executionCounter;
            this.setExecutionCounter(prev => prev + 1);
          }
          
          if (!output || output.length === 0) {
            updates.output = undefined;
          } else {
            const processedOutput = this.processOutputItems(output);
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
    return output.map(item => {
      if ((item.type === 'stderr' || item.type === 'error') && 
          (item.content.includes('[0;') || item.content.includes('[1;'))) {
        try {
          const convert = new Convert({
            fg: '#000',
            bg: '#fff',
            newline: true,
            escapeXML: true,
            stream: false
          });
          const htmlContent = convert.toHtml(item.content);
          return {
            ...item,
            content: htmlContent,
            attrs: {
              ...item.attrs,
              className: `output-area ${item.attrs?.className || ''}`,
              isProcessedAnsi: true
            }
          };
        } catch (error) {
          console.error("Error converting ANSI:", error);
        }
      }
      return {
        ...item,
        attrs: {
          ...item.attrs,
          className: `output-area ${item.attrs?.className || ''}`
        }
      };
    });
  }
  
  // Toggle cell editing mode (for markdown cells)
  toggleCellEditing(id: string, isEditing: boolean): void {
    this.setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { 
          ...cell, 
          metadata: { 
            ...cell.metadata, 
            isEditing 
          } 
        } : cell
      )
    );
  }
  
  // Toggle code visibility (for code cells)
  toggleCodeVisibility(id: string): void {
    this.setCells(prev => 
      prev.map(cell => {
        if (cell.id === id) {
          const currentVisibility = cell.metadata?.isCodeVisible !== false; // if undefined, treat as visible
          return {
            ...cell,
            metadata: {
              ...cell.metadata,
              isCodeVisible: !currentVisibility,
              userModified: true // Mark that user has manually changed visibility
            }
          };
        }
        return cell;
      })
    );
  }
  
  // Set cell role
  updateCellRole(id: string, role: CellRole): void {
    this.setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { 
          ...cell, 
          role, 
          metadata: { ...cell.metadata, role } 
        } : cell
      )
    );
  }
  
  // Change cell type
  changeCellType(id: string, newType: CellType): void {
    this.setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { ...cell, type: newType } : cell
      )
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
    const currentIndex = this.cells.findIndex(c => c.id === currentCellId);
    if (currentIndex === -1) return;

    if (currentIndex < this.cells.length - 1) {
      // Move to next existing cell
      const nextCell = this.cells[currentIndex + 1];
      this.setActiveCellId(nextCell.id);
      
      // Focus the cell with a small delay to ensure DOM is ready
      setTimeout(() => {
        const cellElement = document.querySelector(`[data-cell-id="${nextCell.id}"]`);
        if (cellElement) {
          cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          const editor = this.editorRefs.current[nextCell.id]?.current;
          if (editor) {
            if (nextCell.type === 'code') {
              // For code cells, focus the Monaco editor
              if (typeof editor.focus === 'function') {
                editor.focus();
              } else if (editor.getContainerDomNode) {
                const editorNode = editor.getContainerDomNode();
                if (editorNode) {
                  editorNode.focus();
                  // Try to focus the actual editor input
                  const inputElement = editorNode.querySelector('.monaco-editor textarea');
                  if (inputElement) {
                    (inputElement as HTMLTextAreaElement).focus();
                  }
                }
              }
            } else {
              // For markdown cells, ensure it's in edit mode and focused
              this.toggleCellEditing(nextCell.id, true);
              if (typeof editor.focus === 'function') {
                editor.focus();
              } else if (editor.getContainerDomNode) {
                const editorNode = editor.getContainerDomNode();
                if (editorNode) {
                  editorNode.focus();
                  // Try to focus the actual editor input
                  const inputElement = editorNode.querySelector('textarea');
                  if (inputElement) {
                    (inputElement as HTMLTextAreaElement).focus();
                  }
                }
              }
            }
          }
        }
      }, 100);
    } else {
      // Create and focus new cell at the end
      const newCellId = this.addCell('code', '', 'user');
      this.setActiveCellId(newCellId);
      
      // Focus the new cell
      setTimeout(() => {
        const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
        if (cellElement) {
          cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          const editor = this.editorRefs.current[newCellId]?.current;
          if (editor) {
            if (typeof editor.focus === 'function') {
              editor.focus();
            } else if (editor.getContainerDomNode) {
              const editorNode = editor.getContainerDomNode();
              if (editorNode) {
                editorNode.focus();
                // Try to focus the actual editor input
                const inputElement = editorNode.querySelector('.monaco-editor textarea');
                if (inputElement) {
                  (inputElement as HTMLTextAreaElement).focus();
                }
              }
            }
          }
        }
      }, 100);
    }
  }
  
  // Execute a cell
  async executeCell(id: string, shouldMoveFocus: boolean = false): Promise<void> {
    const cell = this.cells.find(c => c.id === id);
    if (!cell || cell.type !== 'code' || !this.executeCodeFn) return;

    // Get the current code from the editor ref
    const editorRef = this.editorRefs.current[id]?.current;
    const currentCode = editorRef?.getValue?.() || cell.content;

    // Update cell content first to ensure we're using the latest code
    this.updateCellContent(id, currentCode);
    
    // Remember the current visibility state - only expand if collapsed
    const wasVisible = cell.metadata?.isCodeVisible !== false;
    
    // Make code visible during execution if it's not already visible
    if (!wasVisible) {
      this.setCells(prev => prev.map(c => 
        c.id === id 
          ? { 
              ...c, 
              metadata: { 
                ...c.metadata, 
                isCodeVisible: true, // Make code visible during execution
                userModified: true // Mark as user modified to prevent auto-collapse
              } 
            }
          : c
      ));
    }
    
    // Update to running state
    this.updateCellExecutionState(id, 'running');
    
    // If shouldMoveFocus is true, move to the next cell immediately before execution
    if (shouldMoveFocus) {
      this.moveToNextCell(id);
    }
    
    try {
      const outputs: OutputItem[] = [];
      await this.executeCodeFn(currentCode, {
        onOutput: (output: OutputItem) => {
          outputs.push(output);
          this.updateCellExecutionState(id, 'running', outputs);
        },
        onStatus: (status: string) => {
          if (status === 'Completed') {
            this.updateCellExecutionState(id, 'success', outputs);
          } else if (status === 'Error') {
            this.updateCellExecutionState(id, 'error', outputs);
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let content = errorMessage;
      let isProcessedAnsi = false;
      
      // Process ANSI codes in the error message
      if (errorMessage.includes('[0;') || errorMessage.includes('[1;')) {
        try {
          const convert = new Convert({
            fg: '#000',
            bg: '#fff',
            newline: true,
            escapeXML: true,
            stream: false
          });
          content = convert.toHtml(errorMessage);
          isProcessedAnsi = true;
        } catch (e) {
          console.error("Error converting ANSI in error message:", e);
        }
      }
      
      this.updateCellExecutionState(id, 'error', [{
        type: 'stderr',
        content,
        attrs: {
          className: 'output-area error-output',
          isProcessedAnsi
        }
      }]);
    }
  }
  
  // Find cell by condition
  findCell(predicate: (cell: NotebookCell) => boolean): NotebookCell | undefined {
    return this.cells.find(predicate);
  }
  
  // Find last cell by condition
  findLastCell(predicate: (cell: NotebookCell) => boolean): NotebookCell | undefined {
    return this.cells.findLast(predicate);
  }
  
  // Filter cells by specific criteria
  filterCells(predicate: (cell: NotebookCell) => boolean): void {
    this.setCells(prev => prev.filter(predicate));
  }
  
  // Get current state of cells with editor content
  getCurrentCellsContent(): NotebookCell[] {
    return this.cells.map(cell => {
      if (cell.type === 'code') {
        // Get current content from editor ref if visible, otherwise use stored content
        const editorRef = this.editorRefs.current[cell.id];
        const currentContent = cell.metadata?.isCodeVisible === false 
          ? cell.content  // Use stored content if code is hidden
          : editorRef?.current?.getCurrentCode?.() || cell.content;
        
        return {
          ...cell,
          content: currentContent,
          output: cell.output, // Preserve the output array
          executionState: cell.executionState,
          executionCount: cell.executionCount,
          metadata: {
            ...cell.metadata,
            hasOutput: cell.output && cell.output.length > 0
          }
        };
      }
      return cell;
    });
  }
  
  // Save to localStorage
  saveToLocalStorage(): void {
    const currentCells = this.getCurrentCellsContent();
    console.log('[DEBUG] Auto-saving notebook with cells:', currentCells.length);
    saveToLocalStorage(currentCells, this.notebookMetadata);
  }
  
  // Run all cells
  async runAllCells(): Promise<void> {
    for (const cell of this.cells) {
      if (cell.type === 'code') {
        await this.executeCell(cell.id);
      }
    }
  }
  
  // Clear all outputs
  clearAllOutputs(): void {
    this.setCells(prev => prev.map(cell => ({
      ...cell,
      output: undefined,
      executionState: 'idle'
    })));
  }
  
  // Collapse code cell - directly control visibility
  collapseCodeCell(cellId: string): void {
    this.setCells(prev => prev.map(cell => 
      cell.id === cellId
        ? { 
            ...cell,
            metadata: {
              ...cell.metadata,
              isCodeVisible: false // Directly hide code editor but show output
            }
          }
        : cell
    ));
    console.log('[DEBUG] Collapsed code cell:', cellId);
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
    const cell = this.findCell(c => c.id === cellId);
    return cell?.metadata?.parent;
  }

  // Get the parent cell for a cell
  getParentCell(cellId: string): NotebookCell | undefined {
    const parentId = this.getCellParentId(cellId);
    if (!parentId) return undefined;
    return this.findCell(c => c.id === parentId);
  }

  // Add a cell in the agent response context
  addAgentResponseCell(
    type: CellType,
    content: string = '',
    role: CellRole = 'assistant',
    lastUserCellId: string | null
  ): string {
    const referenceCellId = this.getCurrentAgentCell();
    let parentId = lastUserCellId || undefined;

    // Only pass defined values to addCell
    const newCellId = this.addCell(
      type, 
      content, 
      role, 
      referenceCellId || undefined,
      parentId
    );
    this.setCurrentAgentCell(newCellId);
    return newCellId;
  }

  // Update agent response cell content
  updateAgentResponseCell(content: string, lastUserCellId: string | null) {
    const cellId = this.getCurrentAgentCell();
    if (!cellId) {
      // If no current cell exists, create one
      const referenceCellId = this.lastAgentCellRef.current;
      const parentId = lastUserCellId || undefined;

      // Create new markdown cell
      const newCellId = this.addCell(
        'markdown',
        content,
        'assistant',
        referenceCellId || undefined,
        parentId
      );
      this.setCurrentAgentCell(newCellId);
      return;
    }

    // Update existing cell
    this.setCells(prev => prev.map(cell => 
      cell.id === cellId
        ? { 
            ...cell, 
            content,
            metadata: {
              ...cell.metadata,
              isEditing: false // Ensure we're not in editing mode while streaming
            }
          }
        : cell
    ));
  }

  // Handle agent response for messages, function calls, etc.
  handleAgentResponse(item: { 
    type: string; 
    role?: string; 
    content?: any;
    name?: string;
  }, lastUserCellId: string | null): void {
    console.log('[DEBUG] Handling agent response:', JSON.stringify(item, null, 2));
    
    try {
      if (item.type === 'new_completion') {
        // Only clear the current agent cell reference if it's not a function call response
        if (!this.getCurrentAgentCell()?.startsWith('thinking_')) {
          this.clearCurrentAgentCell();
        }
        return;
      }

      // Handle streaming text updates
      if (item.type === 'text' && item.content) {
        console.log('[DEBUG] Streaming text update:', item.content);
        this.updateAgentResponseCell(item.content, lastUserCellId);
        return;
      }

      // Handle function calls (code cells)
      if (item.type === 'function_call') {
        console.log('[DEBUG] Processing function call:', item.name);
        // Only create a new agent cell if we don't have one or if the current one isn't a thinking cell
        const currentAgentCell = this.getCurrentAgentCell();
        if (!currentAgentCell || !currentAgentCell.startsWith('thinking_')) {
          // Create a temporary thinking cell
          const thinkingCellId = `thinking_${this.generateId()}`;
          this.setCurrentAgentCell(thinkingCellId);
        }
        return;
      }

      // Handle function call outputs
      if (item.type === 'function_call_output') {
        console.log('[DEBUG] Processing function call output');
        
        const currentAgentCell = this.getCurrentAgentCell();
        if (currentAgentCell?.startsWith('thinking_')) {
          // If we have a temporary thinking cell ID, clear it
          this.clearCurrentAgentCell();
        }
        
        const lastCodeCell = this.findLastCell(c => c.type === 'code' && c.role === 'assistant');
        if (lastCodeCell?.id) {
          // Find all code cells that are children of the parent user message
          const codeCells = this.findChildrenCells(lastUserCellId || undefined).filter(cell => 
            cell.type === 'code' && 
            cell.role === 'assistant' && 
            cell.executionState === 'success'
          );
          
          // Collapse all successfully executed code cells
          if (codeCells.length > 0) {
            setTimeout(() => {
              codeCells.forEach(cell => {
                if (cell.id) {
                  console.log('[DEBUG] Collapsing code cell:', cell.id);
                  this.collapseCodeCell(cell.id);
                }
              });
            }, 500);
          }
        }
        return;
      }

      // Handle final assistant message
      if (item.type === 'message' && item.role === 'assistant') {
        if (item.content && item.content.length > 0) {
          console.log('[DEBUG] Processing final assistant message with items:', item.content.length);
          
          const referenceCellId = this.getCurrentAgentCell();
          if (referenceCellId?.startsWith('thinking_')) {
            const finalContent = item.content[0].text || item.content[0].content;
            
            const responseCellId = this.addCell(
              'markdown',
              finalContent,
              'assistant',
              undefined,
              lastUserCellId || undefined
            );
            
            console.log('[DEBUG] Added final response cell:', responseCellId);
            
            // Scroll to the newly added response cell
            setTimeout(() => {
              const cellElement = document.querySelector(`[data-cell-id="${responseCellId}"]`);
              if (cellElement) {
                cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }
          
          // Clear the reference cell
          this.clearCurrentAgentCell();
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error processing agent response:', error);
    }
  }

  // Find all children cells of a given cell ID
  findChildrenCells(parentId: string | undefined): NotebookCell[] {
    if (!parentId) return [];
    return this.cells.filter(cell => cell.metadata?.parent === parentId);
  }
  
  // Delete a cell and all its children cells
  deleteWithChildren(id: string): void {
    // First find all children cells
    const childrenCells = this.findChildrenCells(id);
    const childrenIds = childrenCells.map(cell => cell.id);
    
    // Add the parent cell ID to the list of cells to delete
    const allIdsToDelete = [id, ...childrenIds];
    
    // Delete all cells at once
    this.setCells(prev => {
      const newCells = prev.filter(cell => !allIdsToDelete.includes(cell.id));
      
      // Update active cell if needed
      if (allIdsToDelete.includes(this.activeCellId || '')) {
        // Try to activate the cell after the last deleted cell, or previous if there is no next
        const lastDeletedIndex = prev.findIndex(cell => cell.id === id);
        if (lastDeletedIndex !== -1) {
          const nextIndex = Math.min(lastDeletedIndex, newCells.length - 1);
          if (nextIndex >= 0) {
            const nextCell = newCells[nextIndex];
            this.setActiveCellId(nextCell.id);
            // Focus the newly activated cell
            setTimeout(() => {
              const editor = this.editorRefs.current[nextCell.id]?.current;
              if (editor) {
                if (nextCell.type === 'code') {
                  // For code cells, focus the Monaco editor
                  if (typeof editor.focus === 'function') {
                    editor.focus();
                  } else if (editor.getContainerDomNode) {
                    editor.getContainerDomNode()?.focus();
                  }
                } else {
                  // For markdown cells, ensure it's in edit mode and focused
                  this.toggleCellEditing(nextCell.id, true);
                  if (typeof editor.focus === 'function') {
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
      }

      // Clean up editor refs for deleted cells
      allIdsToDelete.forEach(cellId => {
        if (this.editorRefs.current[cellId]) {
          delete this.editorRefs.current[cellId];
        }
      });
      
      return newCells;
    });
  }

  // Regenerate agent responses for a user message cell
  regenerateResponses(userCellId: string): { messageToRegenerate: string, thinkingCellId: string } | void {
    // Find the user message cell
    const userCell = this.findCell(cell => cell.id === userCellId);
    if (!userCell || userCell.role !== 'user') {
      console.error('[DEBUG] Cannot regenerate responses for a non-user cell or cell not found');
      return;
    }
    
    // Get the message content
    const messageContent = userCell.content;
    
    // Find all children cells (responses from the agent for this user message)
    const childrenCells = this.findChildrenCells(userCellId);
    const childrenIds = childrenCells.map(cell => cell.id);
    
    // Remove all children cells first
    this.setCells(prev => prev.filter(cell => !childrenIds.includes(cell.id)));
    
    // Clean up editor refs for deleted cells
    childrenIds.forEach(cellId => {
      if (this.editorRefs.current[cellId]) {
        delete this.editorRefs.current[cellId];
      }
    });
    
    // Add a thinking cell right after the user's message
    const thinkingCellId = this.addCell('markdown', '🤔 Thinking...', 'assistant', userCellId, userCellId);
    
    // Set the thinking cell reference for anchoring responses
    this.setCurrentAgentCell(thinkingCellId);
    
    // Scroll to the thinking message
    setTimeout(() => {
      const cellElement = document.querySelector(`[data-cell-id="${thinkingCellId}"]`);
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    
    // Signal that we want to regenerate a response
    return { 
      messageToRegenerate: messageContent, 
      thinkingCellId
    };
  }

  // Add helper method to find the last cell of a conversation group
  findLastCellOfConversation(cellId: string): string {
    // If cell has no parent
    const activeCell = this.findCell(c => c.id === cellId);
    if (!activeCell) return cellId;
    
    // If cell has a parent, find all cells with the same parent
    const parentId = activeCell.metadata?.parent;
    if (parentId) {
      const allSiblings = this.findChildrenCells(parentId);
      
      // Include the parent cell in consideration
      const parentCell = this.findCell(c => c.id === parentId);
      const conversationCells = [
        parentCell,
        ...allSiblings
      ].filter((cell): cell is NotebookCell => cell !== undefined);
      
      // Sort cells by their position in the notebook
      const sortedCells = conversationCells.sort((a, b) => {
        const indexA = this.cells.findIndex(c => c.id === a.id);
        const indexB = this.cells.findIndex(c => c.id === b.id);
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

  // In CellManager class, add the deleteCellWithChildren method
  deleteCellWithChildren(cellId: string): void {
    // Find the cell and its children
    const cell = this.findCell(c => c.id === cellId);
    if (!cell) return;

    // Get all cells that have this cell as their parent
    const childrenCells = this.findChildrenCells(cellId);
    const childrenIds = childrenCells.map(cell => cell.id);
    
    // Add the parent cell ID to the list of cells to delete
    const allIdsToDelete = [cellId, ...childrenIds];
    
    // Delete all cells at once
    this.setCells(prev => {
      const newCells = prev.filter(cell => !allIdsToDelete.includes(cell.id));
      
      // Update active cell if needed
      if (allIdsToDelete.includes(this.activeCellId || '')) {
        // Try to activate the cell after the last deleted cell, or previous if there is no next
        const lastDeletedIndex = prev.findIndex(cell => cell.id === cellId);
        if (lastDeletedIndex !== -1) {
          const nextIndex = Math.min(lastDeletedIndex, newCells.length - 1);
          if (nextIndex >= 0) {
            const nextCell = newCells[nextIndex];
            this.setActiveCellId(nextCell.id);
            // Focus the newly activated cell
            setTimeout(() => {
              const editor = this.editorRefs.current[nextCell.id]?.current;
              if (editor) {
                if (nextCell.type === 'code') {
                  if (typeof editor.focus === 'function') {
                    editor.focus();
                  } else if (editor.getContainerDomNode) {
                    editor.getContainerDomNode()?.focus();
                  }
                } else {
                  this.toggleCellEditing(nextCell.id, true);
                  if (typeof editor.focus === 'function') {
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
      }

      // Clean up editor refs for deleted cells
      allIdsToDelete.forEach(cellId => {
        if (this.editorRefs.current[cellId]) {
          delete this.editorRefs.current[cellId];
        }
      });
      
      return newCells;
    });
  }
}
