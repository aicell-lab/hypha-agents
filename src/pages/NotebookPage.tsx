import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThebeProvider, useThebe } from '../components/chat/ThebeProvider';
import { CodeCell } from '../components/notebook/CodeCell';
import { ChatInput } from '../components/chat/ChatInput';
import { OutputItem } from '../components/chat/Chat';
import MarkdownCell from '../components/notebook/MarkdownCell';
import { Dialog } from '@headlessui/react';
import Convert from 'ansi-to-html';
import '../styles/ansi.css';
import '../styles/jupyter.css';
import { useHyphaStore } from '../store/hyphaStore';
import { TextModeProvider, useTextMode } from '../components/chat/TextModeProvider';
import { ToolProvider, useTools } from '../components/chat/ToolProvider';
import { JupyterOutput } from '../components/JupyterOutput';
// Import icons
import { FaPlay, FaTrash, FaSyncAlt, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner } from 'react-icons/fa';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';

// Add styles for the active cell
import './NotebookPage.css';

const convert = new Convert({
  fg: '#000',
  bg: '#fff',
  newline: true,
  escapeXML: true,
  stream: false
});

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

interface NotebookData {
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

// Add localStorage constants and helpers
const STORAGE_KEY = 'notebook_state';
const AUTO_SAVE_DELAY = 1000; // 1 second delay for auto-save

// Helper to safely stringify notebook state
const safeStringify = (data: any) => {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error('Error stringifying notebook data:', error);
    return null;
  }
};

// Helper to safely parse notebook state
const safeParse = (str: string | null) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('Error parsing notebook data:', error);
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
        hasOutput: cell.output && cell.output.length > 0
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

// Helper to load notebook state from localStorage
const loadFromLocalStorage = (): { cells: NotebookCell[]; metadata: NotebookMetadata } | null => {
  const data = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!data) return null;
  
  // Ensure we have valid cells array and metadata
  if (!Array.isArray(data.cells)) return null;
  if (!data.metadata || typeof data.metadata !== 'object') return null;
  
  return {
    cells: data.cells.map((cell: NotebookCell) => ({
      ...cell,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2), // Generate new ID
      executionState: 'idle',
      output: cell.output ? cell.output.map((output: OutputItem) => ({
        ...output,
        attrs: {
          ...output.attrs,
          className: `output-area ${output.type === 'stderr' ? 'error-output' : ''}`
        }
      })) : undefined,
      metadata: {
        ...cell.metadata,
        isNew: false
      }
    })),
    metadata: data.metadata
  };
};

// Default agent configuration for notebook code generation
const defaultAgentConfig = {
  name: 'Notebook Code Agent',
  profile: 'Expert Python code generator for Jupyter notebooks',
  goal: 'Help users generate and explain Python code in a notebook environment',
  model: 'gpt-4o-mini', // Using the mini model for faster responses
  stream: true,
  instructions: `You are a code assistant specialized in generating Python code for notebooks. Follow these guidelines:
  1. When asked to generate code, write clean, well-documented Python
  2. In case of errors, use the runCode tool to update the code cell with the new code and try again
  3. When the user asks for explanations, provide clear markdown with concepts and code examples
  4. If the user asks you to execute code, always use the runCode tool rather than suggesting manual execution
  5. Always consider the previous cells and their outputs when generating new code
  6. Prefer using visualizations and examples when explaining concepts`,
  temperature: 0.7
};

const KeyboardShortcutsDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const shortcuts = [
    { key: 'Ctrl/Cmd + Enter', description: 'Run the current cell' },
    { key: 'Shift + Enter', description: 'Run the current cell and select the cell below' },
    { key: 'Ctrl/Cmd + B', description: 'Insert a new code cell below' },
    { key: 'Ctrl/Cmd + Shift + Enter', description: 'Run all cells' },
    { key: 'Ctrl/Cmd + S', description: 'Save notebook' },
    { key: 'Esc', description: 'Enter command mode (when cell is focused)' },
    { key: 'Enter', description: 'Enter edit mode (when cell is focused)' },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg rounded bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-medium mb-4">Keyboard Shortcuts</Dialog.Title>
          
          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex justify-between gap-4 py-1">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{shortcut.key}</kbd>
                <span className="text-gray-600">{shortcut.description}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

// Custom Hook for tool registration that follows React's rules
const useNotebookTools = (
  isReady: boolean,
  handleExecuteCode: (code: string, cell_id?: string) => Promise<string>
) => {
  const { tools, registerTools } = useTools();
  const [isToolRegistered, setIsToolRegistered] = useState(false);
  
  // Register the code execution tool
  useEffect(() => {
    if (!isReady || isToolRegistered) return;
    
    // Check if tool is already registered to prevent duplicate registrations
    const existingTool = tools.find(tool => tool.name === 'runCode');
    if (existingTool) {
      console.log('[DEBUG] runCode tool already registered, skipping registration');
      setIsToolRegistered(true);
      return;
    }
    
    // Register the runCode tool for the agent to use
    console.log('[DEBUG] Registering runCode tool for notebook agent');
    const runCodeTool = {
      type: 'function' as const,
      name: 'runCode',
      description: `Execute Python code in the notebook environment. The code will be added as a new code cell and executed.
Features:
- Persistent variables and imports between runs
- Rich output: text, plots, HTML/JS widgets
- Pre-installed: numpy, scipy, pandas, matplotlib, plotly

Usage:
1. Basic code: print(), display()
2. Package install: await micropip.install(['pkg'])
3. Plots: plt.plot(); plt.show() or fig.show()

Note: A cell_id along with a summary of the outputs will be returned and the full results will be displayed in the notebook interface.
With the cell_id, you can update the cell content in the subsequent tool call, e.g. if the code is incorrect.
`,
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The code to execute' },
          cell_id: { type: 'string', description: 'Optional: the cell_id of the code cell to update' }
        },
        required: ['code']
      },
      fn: async (args: { code: string, cell_id?: string }) => {
        try {
          console.log("[DEBUG] runCode tool fn called with:", args.code.substring(0, 100) + "...", args.cell_id);
          return await handleExecuteCode(args.code, args.cell_id);
        } catch (error) {
          console.error('[DEBUG] Error in runCode tool fn:', error);
          return `Error executing code: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    };

    registerTools([runCodeTool]);
    console.log('[DEBUG] Successfully registered notebook tools');
    setIsToolRegistered(true);
  }, [isReady, tools, registerTools, handleExecuteCode, isToolRegistered]);
  
  return { tools, isToolRegistered };
};

// Function to create a short version of output content
const createShortContent = (content: string, type: string): string => {
  const maxLength = 4096;
  const stripAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
  
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

// Function to convert notebook cells to chat history
const convertCellsToHistory = (cells: NotebookCell[]): Array<{role: string; content: string;}> => {
  const history: Array<{role: string; content: string;}> = [];
  
  for (const cell of cells) {
    // Skip cells without a role (they're not part of the conversation)
    if (!cell.role) continue;
    
    if (cell.type === 'markdown') {
      history.push({
        role: cell.role,
        content: cell.content
      });
    } else if (cell.type === 'code') {
      // Start with the code content
      let content = `\`\`\`python\n${cell.content}\n\`\`\`\n`;
      
      // Add outputs if they exist
      if (cell.output && cell.output.length > 0) {
        content += '\nOutput:\n';
        for (const output of cell.output) {
          switch (output.type) {
            case 'stdout':
            case 'stderr':
              // Use createShortContent for long outputs
              const shortContent = createShortContent(output.content, output.type);
              content += `${output.type === 'stderr' ? 'Error: ' : ''}${shortContent}\n`;
              break;
            case 'html':
              content += '[HTML Output]\n';
              break;
            case 'img':
              content += '[Image Output]\n';
              break;
            case 'svg':
              content += '[SVG Output]\n';
              break;
            default:
              if (output.content) {
                const shortContent = createShortContent(output.content, 'text');
                content += `${shortContent}\n`;
              }
          }
        }
      }
      
      history.push({
        role: cell.role,
        content: content.trim()
      });
    }
  }
  
  return history;
};

// Add default notebook metadata at the top of the file, after interfaces
const defaultNotebookMetadata: NotebookMetadata = {
  kernelspec: {
    name: 'python',
    display_name: 'Python'
  },
  language_info: {
    name: 'python',
    version: '3.10'
  },
  title: 'Untitled Notebook',
  created: new Date().toISOString(),
  modified: new Date().toISOString()
};

// Add CellManager class after the helpers and before NotebookPage component

// Cell Manager utility class to encapsulate cell operations
class CellManager {
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
    role?: CellRole, 
    afterCellId?: string,
    parent?: string
  ): string {
    const newCell: NotebookCell = {
      id: this.generateId(),
      type,
      content: content || (type === 'code' ? '# Enter your code here' : 'Enter your markdown here'),
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
      // If afterCellId is provided, insert after that cell
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
    role?: CellRole, 
    beforeCellId?: string,
    parent?: string
  ): string {
    const newCell: NotebookCell = {
      id: this.generateId(),
      type,
      content: content || (type === 'code' ? '# Enter your code here' : 'Enter your markdown here'),
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
      // If beforeCellId is provided, insert before that cell
      if (beforeCellId) {
        const insertIndex = prev.findIndex(cell => cell.id === beforeCellId);
        if (insertIndex !== -1) {
          const newCells = [...prev];
          newCells.splice(insertIndex, 0, newCell);
          return newCells;
        }
      }
      
      // If beforeCellId not found or not provided, default to adding at the end
      // This is a fallback behavior
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
          // No longer auto-collapse on success
          
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
      
      // Focus the cell
      const cellElement = document.querySelector(`[data-cell-id="${nextCell.id}"]`);
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
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
      }
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
              editor.getContainerDomNode()?.focus();
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
  
  // Handle agent response for messages, function calls, etc.
  handleAgentResponse(item: { 
    type: string; 
    role?: string; 
    content?: any;
    name?: string;  // Add name property for function calls
  }): void {
    console.log('[DEBUG] Handling agent response:', JSON.stringify(item, null, 2));
    
    try {
      // Get the thinking cell ID for placing responses correctly
      const thinkingCellId = this.lastAgentCellRef.current;
      if (!thinkingCellId) {
        console.log('[DEBUG] No thinking cell ID available for response placement');
        return;
      }
      
      // Get the parent cell ID (parent of the thinking cell)
      const thinkingCell = this.findCell(c => c.id === thinkingCellId);
      const parentId = thinkingCell?.metadata?.parent;
      
      // Handle function calls (code cells) - these are handled by handleExecuteCode
      if (item.type === 'function_call') {
        console.log('[DEBUG] Processing function call:', item.name);
        return;
      }
      
      // Handle function call outputs
      if (item.type === 'function_call_output') {
        console.log('[DEBUG] Processing function call output');
        
        // Get the thinking cell to find the parent user message
        const thinkingCell = this.findCell((c: NotebookCell) => c.id === this.lastAgentCellRef.current);
        const parentId = thinkingCell?.metadata?.parent;
        
        if (parentId) {
          // Find all code cells that are children of the parent user message
          const childrenCells = this.findChildrenCells(parentId);
          const codeCells = childrenCells.filter((cell: NotebookCell) => 
            cell.type === 'code' && 
            cell.role === 'assistant' && 
            cell.executionState === 'success'
          );
          
          // Collapse all successfully executed code cells
          if (codeCells.length > 0) {
            setTimeout(() => {
              codeCells.forEach((cell: NotebookCell) => {
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
      
      // Handle final assistant message (this is the last step in the response)
      if (item.type === 'message' && item.role === 'assistant') {
        if (item.content && item.content.length > 0) {
          console.log('[DEBUG] Processing final assistant message with items:', item.content.length);
          
          // Find the thinking cell to verify it exists
          const thinkingCell = this.findCell(c => c.id === thinkingCellId);
          if (!thinkingCell) {
            console.log('[DEBUG] Thinking cell no longer exists:', thinkingCellId);
            return;
          }
          
          // Create a new markdown cell for the response BEFORE the thinking cell
          if (item.content[0]) {
            const responseCellId = this.addCellBefore(
              'markdown',
              item.content[0].text || item.content[0].content,
              'assistant',
              thinkingCellId,
              parentId // Pass the parent ID to link this response to the user message
            );
            
            console.log('[DEBUG] Added final response cell before thinking cell:', responseCellId);
            
            // Scroll to the newly added response cell
            setTimeout(() => {
              const cellElement = document.querySelector(`[data-cell-id="${responseCellId}"]`);
              if (cellElement) {
                cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              
              // Remove the thinking cell with a delay to ensure rendering completes
              setTimeout(() => {
                console.log('[DEBUG] Removing thinking cell after final response:', thinkingCellId);
                // Double check the cell still exists before trying to remove it
                const thinkingCellExists = this.findCell(c => c.id === thinkingCellId);
                if (thinkingCellExists) {
                  this.cleanupThinkingCell(thinkingCellId);
                } else {
                  console.log('[DEBUG] Thinking cell already removed:', thinkingCellId);
                }
              }, 300);
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error processing agent response:', error);
    }
  }

  // Remove the thinking cell after processing is complete
  cleanupThinkingCell(thinkingCellId: string): void {
    if (!thinkingCellId) return;
    
    console.log('[DEBUG] Cleaning up thinking cell:', thinkingCellId);
    
    // Only remove the specific thinking cell, leaving other cells intact
    this.setCells(prev => prev.filter(cell => cell.id !== thinkingCellId));
    
    // Clear the reference to this cell in editorRefs if it exists
    if (this.editorRefs.current[thinkingCellId]) {
      delete this.editorRefs.current[thinkingCellId];
    }
    
    // If this was the active cell, reset active cell to null
    if (this.activeCellId === thinkingCellId) {
      this.setActiveCellId(null);
    }
    
    // Reset lastAgentCellRef if it points to the thinking cell
    if (this.lastAgentCellRef.current === thinkingCellId) {
      this.lastAgentCellRef.current = null;
    }
  }
  
  // Find all children cells of a given cell ID
  findChildrenCells(parentId: string): NotebookCell[] {
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
    this.lastAgentCellRef.current = thinkingCellId;
    
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
    if (activeCell.metadata?.parent) {
      const parentId = activeCell.metadata.parent;
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
}

// Hook to use cell manager
function useCellManager(
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
  const cellManagerRef = useRef<CellManager | null>(null);
  
  if (!cellManagerRef.current) {
    cellManagerRef.current = new CellManager(
      cells,
      setCells,
      activeCellId,
      setActiveCellId,
      executionCounter,
      setExecutionCounter,
      editorRefs,
      notebookMetadata,
      lastAgentCellRef,
      executeCodeFn
    );
  } else {
    // Update the references when they change
    cellManagerRef.current.cells = cells;
    cellManagerRef.current.activeCellId = activeCellId;
    cellManagerRef.current.executionCounter = executionCounter;
    cellManagerRef.current.notebookMetadata = notebookMetadata;
    cellManagerRef.current.executeCodeFn = executeCodeFn;
  }
  
  return cellManagerRef.current;
}

const NotebookPage: React.FC = () => {
  const navigate = useNavigate();
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [executionCounter, setExecutionCounter] = useState(1);
  const endRef = useRef<HTMLDivElement>(null);
  const { isReady, executeCode } = useThebe();
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const hasInitialized = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const [notebookMetadata, setNotebookMetadata] = useState<NotebookMetadata>(defaultNotebookMetadata);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const editorRefs = useRef<{ [key: string]: React.RefObject<any> }>({});
  
  // Add chat agent state
  const { server, isLoggedIn } = useHyphaStore();
  const [schemaAgents, setSchemaAgents] = useState<any>(null);
  const [isProcessingAgentResponse, setIsProcessingAgentResponse] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const { 
    startChat, 
    stopChat, 
    sendText, 
    isChatRunning
  } = useTextMode();

  const [isExecuting, setIsExecuting] = useState(false); // Track global execution state
  const [executingCells, setExecutingCells] = useState<Set<string>>(new Set()); // Track cells that are executing

  // Add a ref to track the last cell ID for agent responses
  const lastAgentCellRef = useRef<string | null>(null);

  // Initialize the cell manager
  const cellManager = useCellManager(
    cells,
    setCells,
    activeCellId,
    setActiveCellId,
    executionCounter,
    setExecutionCounter,
    editorRefs,
    notebookMetadata,
    lastAgentCellRef,
    executeCode
  );

  // Load saved state on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      const savedState = loadFromLocalStorage();
      if (savedState) {
        console.log('Restored notebook state from localStorage');
        cellManager.setCells(savedState.cells);
        setNotebookMetadata(savedState.metadata);
        
        // Find the highest execution count to continue from
        let maxExecutionCount = 0;
        savedState.cells.forEach(cell => {
          if (cell.executionCount && cell.executionCount > maxExecutionCount) {
            maxExecutionCount = cell.executionCount;
          }
        });
        setExecutionCounter(maxExecutionCount + 1);
      } else {
        // No saved state, add welcome cells
        console.log('No saved state found, adding welcome cells');
        cellManager.addCell('markdown', `# 🚀 Welcome to the Interactive Notebook\n\nThis notebook combines the power of Jupyter notebooks with AI assistance.\n\n* Type your question or request in the chat input below\n* Add code cells with \`/code\` command\n* Add markdown cells with \`/markdown\` command\n* Run cells with the run button or Ctrl+Enter`, 'assistant');
        cellManager.addCell('code', '', 'assistant');
      }
      hasInitialized.current = true;
    }
  }, [cellManager]);

  // Update auto-save effect to use a debounce
  useEffect(() => {
    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new auto-save timer with longer delay
    autoSaveTimerRef.current = setTimeout(() => {
      cellManager.saveToLocalStorage();
    }, 2000); // Increased delay to 2 seconds
    
    // Cleanup timer on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [cells, notebookMetadata, cellManager]);

  // Execute a cell with management of execution states
  const executeCell = async (id: string, shouldMoveFocus: boolean = false) => {
    // Update global execution state
    setIsExecuting(true);
    
    // Add cell to executing cells set
    setExecutingCells(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });

    await cellManager.executeCell(id, shouldMoveFocus);
    
    // Remove cell from executing cells set
    setExecutingCells(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      // If no more cells are executing, update global state
      if (newSet.size === 0) {
        setIsExecuting(false);
      }
      return newSet;
    });
  };

  // Update handleExecuteCode to properly save and persist outputs
  const handleExecuteCode = useCallback(async (code: string, cellId?: string): Promise<string> => {
    try {
      let actualCellId = cellId;
      
      if (actualCellId) {
        // Update the existing code cell with the new code
        cellManager.updateCellContent(actualCellId, code);
        console.log('[DEBUG] Updated code cell:', actualCellId);
      }
      else {
        // Get the thinking cell ID for proper placement
        const thinkingCellId = lastAgentCellRef.current;
        
        if (thinkingCellId) {
          // Verify the thinking cell still exists
          const thinkingCell = cellManager.findCell(c => c.id === thinkingCellId);
          
          if (thinkingCell) {
            // Get the parent ID of the thinking cell (the user message that triggered this)
            const parentId = thinkingCell.metadata?.parent;
            
            // Insert code cell BEFORE the thinking cell
            // This keeps it sandwiched between user message and thinking indicator
            actualCellId = cellManager.addCellBefore('code', code, 'assistant', thinkingCellId, parentId);
            console.log('[DEBUG] Added code cell before thinking cell:', actualCellId);
          } else {
            // Fallback: find the last user message and add after it
            const lastUserCell = cellManager.findLastCell(c => c.role === 'user');
            if (lastUserCell) {
              actualCellId = cellManager.addCell('code', code, 'assistant', lastUserCell.id, lastUserCell.id);
              console.log('[DEBUG] Added code cell after last user message:', actualCellId);
            } else {
              // Last resort: add to the end
              actualCellId = cellManager.addCell('code', code, 'assistant');
              console.log('[DEBUG] No reference points found, added code cell at end:', actualCellId);
            }
          }
        } else {
          // Try to find the last user message and add after it
          const lastUserCell = cellManager.findLastCell(c => c.role === 'user');
          if (lastUserCell) {
            actualCellId = cellManager.addCell('code', code, 'assistant', lastUserCell.id, lastUserCell.id);
            console.log('[DEBUG] No thinking cell, added code after last user message:', actualCellId);
          } else {
            // No user message found, add to the end
            actualCellId = cellManager.addCell('code', code, 'assistant');
            console.log('[DEBUG] No user message found, added code cell at end:', actualCellId);
          }
        }
      }
    
      // Update cell state to running and execute the code
      cellManager.updateCellExecutionState(actualCellId, 'running');
      
      const outputs: OutputItem[] = [];
      let shortOutput = '';
      
      try {
        await executeCode(code, {
          onOutput: (output) => {
            // Process ANSI codes in output
            let processedOutput = output;
            if ((output.type === 'stderr' || output.type === 'error') && 
                (output.content.includes('[0;') || output.content.includes('[1;'))) {
              try {
                const htmlContent = convert.toHtml(output.content);
                processedOutput = {
                  ...output,
                  content: htmlContent,
                  attrs: {
                    ...output.attrs,
                    className: `output-area ${output.attrs?.className || ''}`,
                    isProcessedAnsi: true
                  }
                };
              } catch (error) {
                console.error("[DEBUG] ANSI conversion error:", error);
              }
            } else {
              processedOutput = {
                ...output,
                attrs: {
                  ...output.attrs,
                  className: `output-area ${output.attrs?.className || ''}`
                }
              };
            }
            
            // Add to outputs array
            outputs.push(processedOutput);
            
            if (output.type === 'stdout' || output.type === 'stderr') {
              shortOutput += output.content + '\n';
            }
            
            // Update cell with current outputs
            cellManager.updateCellExecutionState(actualCellId, 'running', outputs);
          },
          onStatus: (status) => {
            if (status === 'Completed') {
              // Save final outputs on completion
              cellManager.updateCellExecutionState(actualCellId, 'success', outputs);
              
              // Save to localStorage after successful execution
              setTimeout(() => {
                cellManager.saveToLocalStorage();
              }, 100);
            } else if (status === 'Error') {
              // Save error outputs
              cellManager.updateCellExecutionState(actualCellId, 'error', outputs);
              
              // Save to localStorage after error
              setTimeout(() => {
                cellManager.saveToLocalStorage();
              }, 100);
            }
          }
        });
        return `[Cell Id: ${actualCellId}]\n${shortOutput.trim() || "Code executed successfully. No output generated."}`;
      } catch (error) {
        console.error("[DEBUG] executeCode error:", error);
        
        // Save error state and output
        cellManager.updateCellExecutionState(actualCellId, 'error', [{
          type: 'stderr',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          attrs: { className: 'output-area error-output' }
        }]);
        
        // Save to localStorage after error
        setTimeout(() => {
          cellManager.saveToLocalStorage();
        }, 100);
        
        return `[Cell Id: ${actualCellId}]\nError executing code: ${error instanceof Error ? error.message : String(error)}`;
      }
    } catch (error) {
      console.error("[DEBUG] Fatal error in handleExecuteCode:", error);
      return `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, [cellManager, executeCode, lastAgentCellRef]);

  // Use the proper custom hook to register tools
  const { tools, isToolRegistered } = useNotebookTools(isReady, handleExecuteCode);

  // Handle agent responses
  const handleAgentResponse = useCallback((item: any) => {
    // Forward to cell manager
    cellManager.handleAgentResponse(item);
    
    // Check if this is the final response from the assistant
    const isFinalResponse = item.type === 'message' && item.role === 'assistant';
    
    // When we get the final response, we should set isProcessingAgentResponse to false
    if (isFinalResponse) {
      setIsProcessingAgentResponse(false);
    } else {
      setIsProcessingAgentResponse(item.type === 'function_call' || 
                                 (item.type === 'message' && item.role === 'assistant'));
    }
  }, [cellManager]);

  // Initialize schema-agents
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    const initSchemaAgents = async () => {
      if (!server || !isMounted) return;
      
      // Check if user is logged in and server is connected
      if (!isLoggedIn || !server) {
        console.log('[DEBUG] Waiting for login and server connection before initializing AI assistant');
        setInitializationError(null); // Clear any previous error
        return;
      }
      
      try {
        console.log('[DEBUG] Attempting to initialize schema-agents service...');
        const service = await server.getService("schema-agents");
        
        if (isMounted) {
          if (service) {
            console.log('[DEBUG] Schema-agents service initialized successfully');
            setSchemaAgents(service);
            setInitializationError(null);
          } else {
            console.error('[DEBUG] Schema-agents service returned null');
            setInitializationError("Could not connect to the AI service. Please check your connection.");
            retryIfNeeded();
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('[DEBUG] Failed to initialize schema-agents:', error);
          setInitializationError("Error connecting to AI service: " + 
            (error instanceof Error ? error.message : "Unknown error"));
          retryIfNeeded();
        }
      }
    };
    
    const retryIfNeeded = () => {
      if (retryCount < MAX_RETRIES && isMounted && isLoggedIn && server) {
        retryCount++;
        console.log(`[DEBUG] Retrying schema-agents initialization (attempt ${retryCount}/${MAX_RETRIES})...`);
        setTimeout(initSchemaAgents, 2000); // Wait 2 seconds before retrying
      } else if (isMounted) {
        // Max retries reached or prerequisites not met
        if (!isLoggedIn) {
          setInitializationError("Please log in to use the AI assistant.");
        } else if (!server) {
          setInitializationError("Waiting for server connection...");
        } else {
          setInitializationError("Failed to connect to AI service after multiple attempts. Please refresh the page to try again.");
        }
      }
    };

    // Only initialize if logged in and server is connected
    if (isLoggedIn && server) {
      initSchemaAgents();
    } else {
      console.log('[DEBUG] Waiting for login and server connection...', { isLoggedIn, hasServer: !!server });
      setInitializationError(
        !isLoggedIn ? "Please log in to use the AI assistant." :
        !server ? "Waiting for server connection..." :
        "Waiting for prerequisites..."
      );
    }
    
    return () => {
      isMounted = false;
    };
  }, [server, isLoggedIn]);

  // Auto start chat when ready
  useEffect(() => {
    // Keep track of whether component is mounted
    let isMounted = true;
    
    const startAgentChat = async () => {
      // Skip if already running or missing dependencies
      if (!isReady || !schemaAgents || isChatRunning || !isMounted || !isLoggedIn || !server) {
        console.log('[DEBUG] Skipping chat initialization:', {
          isReady,
          hasSchemaAgents: !!schemaAgents,
          isChatRunning,
          isMounted,
          isLoggedIn,
          hasServer: !!server
        });
        return;
      }
      
      // Make sure tools are available
      if (!tools || tools.length === 0) {
        console.log('[DEBUG] No tools available yet, waiting for tools to be registered...');
        setInitializationError("Waiting for code tools to be registered...");
        return;
      }
      
      // Ensure the runCode tool is registered
      const hasRunCodeTool = tools.some(tool => tool.name === 'runCode');
      if (!hasRunCodeTool) {
        console.warn('[DEBUG] runCode tool not found in registered tools. Available tools:', 
          tools.map(t => t.name)
        );
        setInitializationError("Code execution tool not available. Please try refreshing the page.");
        return;
      }
      
      try {
        console.log('[DEBUG] Starting notebook agent chat with config:', {
          model: defaultAgentConfig.model,
          temperature: defaultAgentConfig.temperature,
          toolCount: tools.length,
          toolNames: tools.map(t => t.name)
        });
        
        // Clear any previous error
        if (initializationError) {
          setInitializationError(null);
        }
        
        await startChat({
          onItemCreated: handleAgentResponse,
          instructions: defaultAgentConfig.instructions,
          temperature: defaultAgentConfig.temperature,
          tools: tools,
          model: defaultAgentConfig.model
        });
        
        console.log('[DEBUG] Chat initialization completed successfully');
      } catch (error) {
        // Only log error if component is still mounted
        if (isMounted) {
          console.error('[DEBUG] Failed to start agent chat:', error);
          setInitializationError("Could not connect to the AI assistant. Will retry automatically.");
        }
      }
    };

    // Only start chat if we have all dependencies
    if (!isChatRunning && isReady && schemaAgents && isLoggedIn && server && tools?.length > 0) {
      console.log('[DEBUG] Starting chat initialization...');
      startAgentChat();
    }
    
    // Clean up when component unmounts
    return () => {
      isMounted = false;
    };
  }, [isReady, schemaAgents, isLoggedIn, server, tools, isChatRunning, handleAgentResponse]);

  // Handle user input from the chat input component
  const handleSendMessage = async (message: string) => {
    // If not logged in, show error
    if (!isLoggedIn) {
      setInitializationError("You must be logged in to use the AI assistant. Please log in and try again.");
      return;
    }

    // If the message starts with / or #, it's a command
    if (message.startsWith('/') || message.startsWith('#')) {
      handleCommand(message);
      return;
    }

    // Determine where to add the new user message
    let targetCellId = activeCellId;
    
    if (targetCellId) {
      // Find the last cell of the conversation if active cell is part of a conversation
      targetCellId = cellManager.findLastCellOfConversation(targetCellId);
    }

    // Add user message after the target cell (or at the end if no target)
    const userCellId = targetCellId 
      ? cellManager.addCell('markdown', message, 'user', targetCellId)
      : cellManager.addCell('markdown', message, 'user');
    
    // Make user message the active cell
    cellManager.setActiveCell(userCellId);
    
    // Add a thinking cell right after the user's message
    // Set the parent of the thinking cell to be the user message cell
    const thinkingCellId = cellManager.addCell('markdown', '🤔 Thinking...', 'assistant', userCellId, userCellId);
    
    // Set the thinking cell reference for anchoring responses
    lastAgentCellRef.current = thinkingCellId;
    
    // Scroll to the thinking message
    setTimeout(() => {
      const cellElement = document.querySelector(`[data-cell-id="${thinkingCellId}"]`);
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    
    // Send to agent
    if (isChatRunning) {
      try {
        setIsProcessingAgentResponse(true);
        await sendText(message);
      } catch (error) {
        console.error('Error sending message to AI:', error);
        // Remove the thinking cell
        cellManager.deleteCell(thinkingCellId);
        setInitializationError("Error communicating with AI assistant. Please try again or refresh the page.");
      } finally {
        setIsProcessingAgentResponse(false);
        
        // Note: We don't remove the thinking cell here anymore.
        // It's now removed by the handleAgentResponse method after the final 
        // assistant message is processed
      }
    }
  };

  // Handle special commands
  const handleCommand = (command: string) => {
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
          const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
          if (cellElement) {
            cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
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
    
    // Scroll to the newly created cell
    if (newCellId) {
      setTimeout(() => {
        const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
        if (cellElement) {
          cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  // Handle markdown cell rendering
  const handleMarkdownRender = useCallback((id: string) => {
    const cell = cellManager.findCell(c => c.id === id);
    if (cell && cell.type === 'markdown') {
      cellManager.toggleCellEditing(id, false);
    }
  }, [cellManager]);

  // Add keyboard event handler
  const handleKeyboardEvent = useCallback((e: KeyboardEvent) => {
    // Only ignore if we're in a text input field (not Monaco editor)
    if (e.target instanceof HTMLInputElement || 
        (e.target instanceof HTMLTextAreaElement && 
         !(e.target.closest('.monaco-editor') || e.target.closest('.notebook-cell-container')))) {
      return;
    }

    // Handle Escape key to focus active cell
    if (e.key === 'Escape') {
      if (activeCellId) {
        const cellElement = document.querySelector(`[data-cell-id="${activeCellId}"]`);
        if (cellElement) {
          (cellElement as HTMLElement).focus();
        }
      }
      return;
    }

    // Handle Shift + Enter
    if (e.shiftKey && e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();

      const activeCell = document.activeElement?.closest('[data-cell-id]');
      if (!activeCell) return;
      
      const cellId = activeCell.getAttribute('data-cell-id');
      if (!cellId) return;
      
      // Get cell from cellManager
      const cell = cellManager.findCell(c => c.id === cellId);
      if (!cell) return;
      
      if (cell.type === 'code') {
        executeCell(cellId, true); // Execute and move focus
      } else if (cell.type === 'markdown') {
        handleMarkdownRender(cellId);
        cellManager.moveToNextCell(cellId);
      }
      return;
    }

    // Handle Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const activeCell = document.activeElement?.closest('[data-cell-id]');
      if (activeCell) {
        const cellId = activeCell.getAttribute('data-cell-id');
        if (cellId) {
          executeCell(cellId, false);
        }
      }
      return;
    }

    // Handle Ctrl/Cmd + B
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const activeCell = document.activeElement?.closest('[data-cell-id]');
      if (activeCell) {
        const cellId = activeCell.getAttribute('data-cell-id');
        if (cellId) {
          const newCellId = cellManager.addCell('code', '', 'user');
          cellManager.setActiveCell(newCellId);
          const editor = editorRefs.current[newCellId]?.current;
          if (editor) {
            if (editor.focus) editor.focus();
            else if (editor.getContainerDomNode) editor.getContainerDomNode()?.focus();
          }
        }
      }
      return;
    }

    // Handle Ctrl/Cmd + Shift + Enter
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      cellManager.runAllCells();
      return;
    }
  }, [executeCell, handleMarkdownRender, cellManager, editorRefs, activeCellId]);

  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardEvent);
    return () => window.removeEventListener('keydown', handleKeyboardEvent);
  }, [handleKeyboardEvent]);

  // Pass editor refs to components
  const getEditorRef = useCallback((id: string) => {
    if (!editorRefs.current[id]) {
      editorRefs.current[id] = React.createRef();
    }
    return editorRefs.current[id];
  }, []);

  // Clean up refs when cells are removed
  useEffect(() => {
    const currentIds = new Set(cells.map(cell => cell.id));
    Object.keys(editorRefs.current).forEach(id => {
      if (!currentIds.has(id)) {
        delete editorRefs.current[id];
      }
    });
  }, [cells]);

  // Restart kernel and clear outputs
  const restartKernel = async () => {
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to restart the kernel? This will clear all outputs and reset the execution state.')) {
      return;
    }
    
    cellManager.clearAllOutputs();
    setExecutionCounter(1);
    
    try {
      // Attempt to restart the kernel
      if (isReady) {
        await executeCode('%reset -f'); // Force reset IPython namespace
        await executeCode('%reset_selective -f out'); // Reset output history
        console.log('Kernel reset successfully');
      }
    } catch (error) {
      console.error('Error resetting kernel:', error);
    }
  };

  // Update save function to include current editor content
  const saveNotebook = () => {
    cellManager.saveToLocalStorage();
    // Show a brief success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = 'Notebook saved successfully';
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  // Update download function to include current editor content
  const downloadNotebook = () => {
    const currentCells = cellManager.getCurrentCellsContent();
    console.log('[DEBUG] Downloading notebook with cells:', currentCells.length);
    const notebookData: NotebookData = {
      metadata: {
        ...notebookMetadata,
        modified: new Date().toISOString()
      },
      cells: currentCells.map(cell => ({
        ...cell,
        id: cell.id,
        type: cell.type,
        content: cell.content,
        executionCount: cell.executionCount,
        executionState: cell.executionState,
        output: cell.output ? cell.output.map(output => ({
          ...output,
          attrs: {
            ...output.attrs,
            className: undefined
          }
        })) : undefined,
        role: cell.role,
        metadata: {
          ...cell.metadata,
          role: cell.role,
          collapsed: false,
          trusted: true
        }
      }))
    };

    const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${notebookMetadata.title?.replace(/\s+/g, '_')}.ipynb` || 'untitled.ipynb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load notebook function
  const loadNotebook = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const notebookData: NotebookData = JSON.parse(content);
        
        // Ensure title is always defined
        const metadata = {
          ...defaultNotebookMetadata,
          ...notebookData.metadata,
          title: notebookData.metadata?.title || 'Untitled Notebook',
          modified: new Date().toISOString()
        };
        
        setNotebookMetadata(metadata);
        
        // Find the highest execution count to continue from
        let maxExecutionCount = 0;
        notebookData.cells.forEach(cell => {
          if (cell.executionCount && cell.executionCount > maxExecutionCount) {
            maxExecutionCount = cell.executionCount;
          }
        });
        
        setExecutionCounter(maxExecutionCount + 1);
        
        // Clear existing cells using cellManager
        cellManager.clearAllCells();
        
        // Add a small delay to ensure cells are cleared before adding new ones
        setTimeout(() => {
          // Create new cells using cellManager
          notebookData.cells.forEach((cell, index) => {
            // Create the cell with the appropriate type, content and role
            const cellId = cellManager.addCell(
              cell.type, 
              cell.content || '',
              cell.role || (cell.metadata?.role as CellRole | undefined)
            );
            
            // Update cell with execution state and outputs if they exist
            if (cell.executionCount) {
              const executionState = cell.executionState || 'idle';
              const outputs = cell.output ? 
                cell.output.map(output => ({
                  ...output,
                  attrs: {
                    ...output.attrs,
                    className: `output-area ${output.type === 'stderr' ? 'error-output' : ''}`
                  }
                })) : undefined;
                
              cellManager.updateCellExecutionState(cellId, executionState, outputs);
            }
            
            // Set code visibility based on metadata
            if (cell.type === 'code' && cell.metadata?.isCodeVisible === false) {
              cellManager.toggleCodeVisibility(cellId);
            }
            
            // If it's the last cell, make it active
            if (index === notebookData.cells.length - 1) {
              cellManager.setActiveCell(cellId);
            }
          });

          // Save the newly loaded notebook to localStorage
          cellManager.saveToLocalStorage();
        }, 100);
      } catch (error) {
        console.error('Error loading notebook:', error);
      }
    };
    reader.readAsText(file);
  };

  // Update keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only ignore if we're in a text input field (not Monaco editor)
      if (e.target instanceof HTMLInputElement || 
          (e.target instanceof HTMLTextAreaElement && 
           !(e.target.closest('.monaco-editor') || e.target.closest('.notebook-cell-container')))) {
        return;
      }

      // Save shortcut (Ctrl/Cmd + S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl/Cmd + Shift + S for download
          downloadNotebook();
        } else {
          // Ctrl/Cmd + S for save
          saveNotebook();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cells, notebookMetadata, cellManager]);

  // Handle regeneration of agent responses
  const handleRegenerateClick = async (cellId: string) => {
    if (!isChatRunning || !isReady || isProcessingAgentResponse) {
      console.log('[DEBUG] Cannot regenerate while processing another response or not ready', 
        { isChatRunning, isReady, isProcessingAgentResponse });
      return;
    }
    
    try {
      // Use cellManager to regenerate responses
      const result = cellManager.regenerateResponses(cellId);
      
      if (!result) {
        console.error('[DEBUG] Failed to prepare for regeneration');
        return;
      }
      
      setIsProcessingAgentResponse(true);
      
      // Send the original message back to the agent
      await sendText(result.messageToRegenerate);
    } catch (error) {
      console.error('[DEBUG] Error regenerating responses:', error);
      setInitializationError("Error regenerating response. Please try again.");
      setIsProcessingAgentResponse(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={notebookMetadata.title || 'Untitled Notebook'}
                onChange={(e) => setNotebookMetadata(prev => ({ 
                  ...prev, 
                  title: e.target.value || 'Untitled Notebook',
                  modified: new Date().toISOString()
                }))}
                className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                placeholder="Untitled Notebook"
              />
            </div>

            {/* Action buttons in a single row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <input
                  type="file"
                  accept=".ipynb"
                  onChange={loadNotebook}
                  className="hidden"
                  id="notebook-file"
                  aria-label="Open notebook file"
                />
                <label
                  htmlFor="notebook-file"
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition cursor-pointer flex items-center"
                  title="Open notebook"
                >
                  <FaFolder className="w-4 h-4" />
                </label>
                <button
                  onClick={saveNotebook}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                  title="Save notebook (Ctrl/Cmd + S)"
                >
                  <FaSave className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadNotebook}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                  title="Download notebook (Ctrl/Cmd + Shift + S)"
                >
                  <FaDownload className="w-4 h-4" />
                </button>
                <button
                  onClick={() => cellManager.runAllCells()}
                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                  title="Run all cells (Ctrl/Cmd + Shift + Enter)"
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <FaSpinner className="w-4 h-4 animate-spin" />
                  ) : (
                    <FaPlay className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => cellManager.clearAllOutputs()}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                  title="Clear all outputs"
                  disabled={isExecuting}
                >
                  <FaTrash className="w-4 h-4" />
                </button>
                <button
                  onClick={restartKernel}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition group relative"
                  title="Restart kernel and clear outputs"
                  disabled={!isReady || isExecuting}
                >
                  <FaRedo className={`w-4 h-4 ${(!isReady || isExecuting) ? 'opacity-50' : ''}`} />
                </button>
              </div>

              <div className="flex items-center ml-2 border-l border-gray-200 pl-2">
                <button 
                  onClick={() => {
                    const newCellId = cellManager.addCell('code');
                    // Focus the new cell
                    setTimeout(() => {
                      const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
                      if (cellElement) {
                        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 100);
                  }}
                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition flex items-center"
                  title="Add code cell (Ctrl/Cmd + B)"
                >
                  <VscCode className="w-4 h-4 mr-1" />
                  <AiOutlinePlus className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => {
                    const newCellId = cellManager.addCell('markdown');
                    // Focus the new cell
                    setTimeout(() => {
                      const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
                      if (cellElement) {
                        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 100);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition flex items-center"
                  title="Add markdown cell"
                >
                  <MdOutlineTextFields className="w-4 h-4 mr-1" />
                  <AiOutlinePlus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setIsShortcutsDialogOpen(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition ml-2"
                  title="Keyboard Shortcuts"
                >
                  <FaKeyboard className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notebook Content Area - Add more bottom padding */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 pb-48">
        <div className="max-w-5xl mx-auto px-4 notebook-cells-container">
          {cells.map((cell, index) => (
            <div 
              key={cell.id}
              data-cell-id={cell.id}
              className={`notebook-cell-container group relative ${
                cell.executionState === 'error' ? 'border-red-200' : ''
              } ${
                activeCellId === cell.id ? 'notebook-cell-container-active' : ''
              } mb-1 bg-white overflow-hidden rounded-md`}
              onClick={() => cellManager.setActiveCell(cell.id)}
              tabIndex={0}
            >
              {/* Active cell indicator strip */}
              {activeCellId === cell.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
              )}
              {/* Cell Content */}
              <div className="flex relative w-full">
                <div className="flex-1 min-w-0 w-full overflow-x-hidden">
                  {cell.type === 'code' ? (
                    <div className="py-2 w-full">
                      <CodeCell 
                        code={cell.content} 
                        language="python"
                        defaultCollapsed={false}
                        onExecute={() => executeCell(cell.id)}
                        isExecuting={cell.executionState === 'running'}
                        executionCount={cell.executionState === 'running' ? undefined : cell.executionCount}
                        blockRef={getEditorRef(cell.id)}
                        isActive={activeCellId === cell.id}
                        role={cell.role}
                        onRoleChange={(role) => cellManager.updateCellRole(cell.id, role)}
                        onChange={(newCode) => cellManager.updateCellContent(cell.id, newCode)}
                        hideCode={cell.metadata?.isCodeVisible === false}
                        onVisibilityChange={() => cellManager.toggleCodeVisibility(cell.id)}
                      />
                    </div>
                  ) : (
                    <MarkdownCell
                      content={cell.content}
                      onChange={(content) => cellManager.updateCellContent(cell.id, content)}
                      initialEditMode={cell.metadata?.isNew === true}
                      role={cell.role}
                      onRoleChange={(role) => cellManager.updateCellRole(cell.id, role)}
                      isEditing={cell.metadata?.isEditing || false}
                      onEditingChange={(isEditing) => cellManager.toggleCellEditing(cell.id, isEditing)}
                      editorRef={getEditorRef(cell.id)}
                      isActive={activeCellId === cell.id}
                      parent={cell.metadata?.parent}
                    />
                  )}
                  
                  {/* Output Area */}
                  {cell.type === 'code' && cell.output && cell.output.length > 0 && (
                    <div className="jupyter-cell-flex-container">
                      {/* Empty execution count to align with code */}
                      <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
                        {cell.executionState === 'running' ? (
                          <FaSpinner className="w-4 h-4 animate-spin text-blue-500" />
                        ) : (
                          cell.executionCount ? `[${cell.executionCount}]:` : ''
                        )}
                      </div>
                      <div className="editor-container w-full overflow-hidden">
                        <div className="bg-gray-50 p-2 rounded-b-md border-none">
                          <JupyterOutput 
                            outputs={cell.output} 
                            className="output-area ansi-enabled" 
                            wrapLongLines={true} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cell Toolbar - Show on hover */}
                <div 
                  className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded px-1 z-10 hover:opacity-100"
                  style={{ pointerEvents: 'auto' }}
                >
                  {/* Cell Type Indicator */}
                  <span className="text-xs text-gray-500 px-1 border-r border-gray-200 mr-1">
                    {cell.type === 'code' ? (
                      <span className="flex items-center gap-1">
                        <VscCode className="w-3 h-3" />
                        Code
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <MdOutlineTextFields className="w-3 h-3" />
                        Markdown
                      </span>
                    )}
                  </span>

                  {cell.type === 'code' && (
                    <>
                      {/* Hide/Show Code Button - Moved before Run button */}
                      <button
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          cellManager.toggleCodeVisibility(cell.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                        title={cell.metadata?.isCodeVisible === false ? "Show code" : "Hide code"}
                      >
                        <svg 
                          className={`w-4 h-4 transition-transform ${cell.metadata?.isCodeVisible === false ? 'transform rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d={cell.metadata?.isCodeVisible === false
                              ? "M9 5l7 7-7 7"
                              : "M19 9l-7 7-7-7"
                            } 
                          />
                        </svg>
                        <span className="text-xs">
                          {cell.metadata?.isCodeVisible === false ? 'Show' : 'Hide'}
                        </span>
                      </button>

                      <button
                        onClick={() => executeCell(cell.id)}
                        disabled={!isReady || cell.executionState === 'running'}
                        className="p-1 hover:bg-gray-100 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Run cell"
                      >
                        {cell.executionState === 'running' ? (
                          <FaSpinner className="w-4 h-4 animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <span className="text-xs">Run</span>
                      </button>

                      <button
                        onClick={() => cellManager.changeCellType(cell.id, 'markdown')}
                        className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                        title="Convert to Markdown"
                        disabled={cell.executionState === 'running'}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span className="text-xs">Convert</span>
                      </button>
                    </>
                  )}
                  
                  {cell.type === 'markdown' && (
                    <>
                      {cell.metadata?.isEditing ? (
                        <button
                          onClick={() => handleMarkdownRender(cell.id)}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                          title="Render markdown (Shift+Enter)"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs">Render</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => cellManager.toggleCellEditing(cell.id, true)}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                          title="Edit markdown"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          <span className="text-xs">Edit</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => cellManager.changeCellType(cell.id, 'code')}
                        className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                        title="Convert to Code"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span className="text-xs">Convert</span>
                      </button>
                    </>
                  )}

                  {/* Add regenerate button for user message cells */}
                  {cell.role === 'user' && (
                    <button
                      onClick={() => handleRegenerateClick(cell.id)}
                      disabled={!isChatRunning || !isReady || isProcessingAgentResponse}
                      className="p-1 hover:bg-green-100 rounded text-green-600 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Regenerate AI response"
                    >
                      <FaSyncAlt className="w-3 h-3" />
                      <span className="text-xs">Regenerate</span>
                    </button>
                  )}
                  
                  {/* Delete buttons - different for user vs. assistant cells */}
                  {cell.role === 'user' ? (
                    <div className="relative flex items-center gap-1">
                      {/* Delete button group with expanding options */}
                      <div className="flex items-center gap-1 bg-white rounded overflow-hidden transition-all duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const target = e.currentTarget.parentElement;
                            if (target) {
                              target.classList.toggle('expanded');
                            }
                          }}
                          className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1"
                          title="Delete options"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-xs">Delete</span>
                        </button>
                        
                        {/* Additional delete options - initially hidden */}
                        <div className="hidden expanded:flex items-center gap-1 ml-1 pl-1 border-l border-gray-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cellManager.deleteCell(cell.id);
                            }}
                            className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1 whitespace-nowrap"
                          >
                            <span className="text-xs">This Cell</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cellManager.deleteWithChildren(cell.id);
                            }}
                            className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1 whitespace-nowrap"
                          >
                            <span className="text-xs">With Responses</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cellManager.deleteCell(cell.id);
                      }}
                      className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1"
                      title="Delete cell"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="text-xs">Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area - Add a semi-transparent background */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm p-4 shadow-md z-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-2 text-xs text-center">
            {!isLoggedIn ? (
              <div className="p-2 bg-yellow-100 rounded">
                <p className="text-yellow-800 font-semibold">You need to log in to use the AI assistant</p>
                <button 
                  onClick={() => navigate('/')}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <p className="text-gray-500">
                {isProcessingAgentResponse ? "AI is thinking..." : 
                initializationError ? initializationError :
                !isChatRunning ? "Initializing AI assistant..." :
                "Ask a question or use commands like /code or /markdown to add specific cell types"}
              </p>
            )}
            {initializationError && !isChatRunning && isLoggedIn && (
              <button 
                onClick={() => {
                  setInitializationError(null);
                  if (schemaAgents && isReady) {
                    // Check if tools are available 
                    if (!tools || tools.length === 0) {
                      setInitializationError("Code tools not available. Please wait or refresh the page.");
                      return;
                    }
                    
                    // Ensure runCode tool is registered
                    const hasRunCodeTool = tools.some(tool => tool.name === 'runCode');
                    if (!hasRunCodeTool) {
                      console.warn('runCode tool not found in registered tools');
                      setInitializationError("Code execution tool not available. Please refresh the page.");
                      return;
                    }
                    
                    console.log('Manual retry - starting chat with tools:', tools.map(t => t.name));
                    startChat({
                      onItemCreated: handleAgentResponse,
                      instructions: defaultAgentConfig.instructions,
                      temperature: defaultAgentConfig.temperature,
                      tools: tools,
                      model: defaultAgentConfig.model
                    }).catch(err => {
                      console.error("Manual retry failed:", err);
                      setInitializationError("Retry failed. Please refresh the page.");
                    });
                  } else {
                    setInitializationError(
                      !isReady 
                        ? "Code execution environment not ready. Please wait..." 
                        : !schemaAgents 
                          ? "AI service not available. Please refresh the page."
                          : "Cannot retry at this time. Please refresh the page."
                    );
                  }
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
              >
                Retry Connection
              </button>
            )}
          </div>
          <ChatInput 
            onSend={handleSendMessage} 
            disabled={!isReady || !isChatRunning || isProcessingAgentResponse || !isLoggedIn}
            isThebeReady={isReady}
            placeholder={
              !isLoggedIn ? "Please log in to use the AI assistant" :
              !isReady ? "Initializing code execution environment..." : 
              initializationError ? "AI assistant connection failed..." :
              !isChatRunning ? "Connecting to AI assistant..." :
              isProcessingAgentResponse ? "AI is thinking..." :
              "Enter text or command (e.g., /code, /markdown, /clear)"
            }
            agentInstructions={defaultAgentConfig.instructions}
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={isShortcutsDialogOpen}
        onClose={() => setIsShortcutsDialogOpen(false)}
      />
    </div>
  );
};

const NotebookPageWithThebe: React.FC = () => (
  <ThebeProvider>
    <ToolProvider>
      <TextModeProvider>
        <NotebookPage />
      </TextModeProvider>
    </ToolProvider>
  </ThebeProvider>
);

export default NotebookPageWithThebe; 