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
  title?: string;
  created?: string;
  modified?: string;
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
    cells,
    metadata: {
      ...metadata,
      modified: new Date().toISOString()
    }
  });
  if (data) {
    try {
      localStorage.setItem(STORAGE_KEY, data);
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
  2. Include detailed comments explaining your code
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
  executeCode: any,
  handleExecuteCode: (code: string) => Promise<string>
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

Note: The results will be displayed in the notebook interface.`,
      category: 'Code Execution',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' }
        },
        required: ['code']
      },
      fn: async (args: { code: string }) => {
        try {
          console.log("[DEBUG] runCode tool fn called with:", args.code.substring(0, 100) + "...");
          return await handleExecuteCode(args.code);
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

const NotebookPage: React.FC = () => {
  const navigate = useNavigate();
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [executionCounter, setExecutionCounter] = useState(1);
  const endRef = useRef<HTMLDivElement>(null);
  const { isReady, executeCode } = useThebe();
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const cellRefs = useRef<{ [key: string]: React.RefObject<{ getCurrentCode: () => string }> }>({});
  const hasInitialized = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const [notebookMetadata, setNotebookMetadata] = useState<NotebookMetadata>({
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
  });
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

  // Add state for editing cells
  const toggleCellEditing = (id: string, isEditing: boolean) => {
    setCells(prev => 
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
  };

  // Create a stable addCell function with useCallback
  const addCell = useCallback((type: CellType, content: string = '', role?: CellRole) => {
    const newCell: NotebookCell = {
      id: generateId(),
      type,
      content: content || (type === 'code' ? '# Enter your code here' : 'Enter your markdown here'),
      executionState: 'idle',
      role,
      metadata: {
        collapsed: false,
        trusted: true,
        isNew: type === 'code', // Only set isNew to true for code cells
        role: role,
        isEditing: false
      }
    };
    
    // Create a ref for the new cell
    editorRefs.current[newCell.id] = React.createRef();
    
    setCells(prev => {
      // If there's an active cell, insert after it
      if (activeCellId) {
        const activeIndex = prev.findIndex(cell => cell.id === activeCellId);
        if (activeIndex !== -1) {
          const newCells = [...prev];
          newCells.splice(activeIndex + 1, 0, newCell);
          return newCells;
        }
      }
      // If no active cell or active cell not found, append to the end
      return [...prev, newCell];
    });

    setActiveCellId(newCell.id); // Set as active cell

    // Scroll the new cell into view and focus it
    setTimeout(() => {
      // Find the cell element
      const cellElement = document.querySelector(`[data-cell-id="${newCell.id}"]`);
      if (cellElement) {
        // Scroll the cell into view with smooth behavior
        cellElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
        
        // Focus the editor after scrolling
        const editor = editorRefs.current[newCell.id]?.current;
        if (editor && type === 'code') { // Only focus code cells
          if (typeof editor.focus === 'function') {
            editor.focus();
          } else if (editor.getContainerDomNode) {
            editor.getContainerDomNode()?.focus();
          }
        }
      }
    }, 100); // Short delay to ensure the cell is rendered

    return newCell.id;
  }, [activeCellId]);

  // Load saved state on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      const savedState = loadFromLocalStorage();
      if (savedState) {
        console.log('Restored notebook state from localStorage');
        setCells(savedState.cells);
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
        addCell('markdown', `# 🚀 Welcome to the Interactive Notebook\n\nThis notebook combines the power of Jupyter notebooks with AI assistance.\n\n* Type your question or request in the chat input below\n* Add code cells with \`/code\` command\n* Add markdown cells with \`/markdown\` command\n* Run cells with the run button or Ctrl+Enter`, 'assistant');
        addCell('code', '', 'assistant');
      }
      hasInitialized.current = true;
    }
  }, [addCell]);

  // Auto-save whenever cells or metadata changes
  useEffect(() => {
    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new auto-save timer
    autoSaveTimerRef.current = setTimeout(() => {
      const currentCells = getCurrentCellsContent();
      console.log('[DEBUG] Auto-saving notebook with cells:', currentCells.length);
      saveToLocalStorage(currentCells, notebookMetadata);
    }, AUTO_SAVE_DELAY);
    
    // Cleanup timer on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [cells, notebookMetadata]);

  // Generate a unique ID for cells
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };
  
  // Update cell content
  const updateCellContent = (id: string, content: string) => {
    setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { ...cell, content } : cell
      )
    );
  };

  // Update cell execution state
  const updateCellExecutionState = (id: string, state: ExecutionState, output?: OutputItem[]) => {
    setCells(prev => 
      prev.map(cell => {
        if (cell.id === id) {
          const updates: Partial<NotebookCell> = { executionState: state };
          if (state === 'success' && cell.type === 'code') {
            updates.executionCount = executionCounter;
            setExecutionCounter(prev => prev + 1);
          }
          // Always set output to undefined if no output is provided or empty array
          if (!output || output.length === 0) {
            updates.output = undefined;
          } else {
            // Process output items to ensure consistent styling
            const processedOutput = output.map(item => {
              // Special processing for stderr and error types to handle ANSI codes
              if ((item.type === 'stderr' || item.type === 'error') && 
                  (item.content.includes('[0;') || item.content.includes('[1;'))) {
                try {
                  // Use raw HTML output since we'll render it with dangerouslySetInnerHTML
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
                  // Fall back to unprocessed content if conversion fails
                  return {
                    ...item,
                    attrs: {
                      ...item.attrs,
                      className: `output-area ${item.attrs?.className || ''}`
                    }
                  };
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
            updates.output = processedOutput;
          }
          return { ...cell, ...updates };
        }
        return cell;
      })
    );
  };

  // Execute a cell
  const executeCell = async (id: string, shouldMoveFocus: boolean = false) => {
    const cell = cells.find(c => c.id === id);
    if (!cell || cell.type !== 'code' || !isReady) return;

    // Get the current code from the editor ref
    const editorRef = editorRefs.current[id]?.current;
    const currentCode = editorRef?.getValue?.() || cell.content;

    // Update cell content first to ensure we're using the latest code
    updateCellContent(id, currentCode);
    updateCellExecutionState(id, 'running');
    
    // Update global execution state
    setIsExecuting(true);
    
    // Add cell to executing cells set
    setExecutingCells(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });

    // If shouldMoveFocus is true, move to the next cell immediately before execution
    if (shouldMoveFocus) {
      moveToNextCell(id);
    }
    
    try {
      const outputs: OutputItem[] = [];
      await executeCode(currentCode, {
        onOutput: (output) => {
          // Process output to ensure proper ANSI handling
          let processedOutput = output;
          
          // Handle ANSI codes in stderr and error outputs
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
              console.error("Error converting ANSI:", error);
              processedOutput = {
                ...output,
                attrs: {
                  ...output.attrs,
                  className: `output-area ${output.attrs?.className || ''}`
                }
              };
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
          
          outputs.push(processedOutput);
          updateCellExecutionState(id, 'running', outputs);
        },
        onStatus: (status) => {
          if (status === 'Completed') {
            updateCellExecutionState(id, 'success', outputs);
            
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
          } else if (status === 'Error') {
            updateCellExecutionState(id, 'error', outputs);
            
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
          content = convert.toHtml(errorMessage);
          isProcessedAnsi = true;
        } catch (e) {
          console.error("Error converting ANSI in error message:", e);
        }
      }
      
      updateCellExecutionState(id, 'error', [{
        type: 'stderr',
        content,
        attrs: {
          className: 'output-area error-output',
          isProcessedAnsi
        }
      }]);
      
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
    }
  };

  // Handle code execution from agent
  const handleExecuteCode = useCallback(async (code: string): Promise<string> => {
    try {
      console.log("[DEBUG] handleExecuteCode - Starting execution with code:", code.substring(0, 100) + "...");
      
      // Create a new code cell with the agent's code - CRITICAL STEP
      const cellId = addCell('code', code, 'assistant');
      console.log("[DEBUG] New cell created with ID:", cellId);
      
      // Scroll to the new code cell
      setTimeout(() => {
        const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cellElement) {
          cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log("[DEBUG] Scrolled to newly added code cell:", cellId);
        }
      }, 50);
      
      // Force immediate state update to ensure cell is visible
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Mark cell as running to show it's being processed
      updateCellExecutionState(cellId, 'running');
      console.log("[DEBUG] Cell marked as running");
      
      // Execute code and collect outputs
      const outputs: OutputItem[] = [];
      let shortOutput = 'Outputs:\n'; // Track short output for LLM response
      
      try {
        await executeCode(code, {
          onOutput: (output) => {
            console.log("[DEBUG] Output received:", output.type);
            
            // Process output
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
            
            // Save output to array
            outputs.push(processedOutput);
            
            // Update short output for LLM response
            if (output.type === 'stdout' || output.type === 'stderr') {
              shortOutput += output.content + '\n';
            }
            
            // Update the running cell with current outputs
            setCells(prevCells => 
              prevCells.map(cell => 
                cell.id === cellId ? {
                  ...cell,
                  executionState: 'running' as ExecutionState,
                  output: [...outputs]
                } : cell
              )
            );
          },
          onStatus: (status) => {
            console.log("[DEBUG] Execution status:", status);
            
            if (status === 'Completed') {
              console.log("[DEBUG] Code completed successfully, setting success state with outputs:", outputs.length);
              
              // Mark the cell as successfully executed with proper execution count
              setCells(prevCells => 
                prevCells.map(cell => 
                  cell.id === cellId ? {
                    ...cell, 
                    executionState: 'success' as ExecutionState,
                    executionCount: executionCounter,
                    // Only set output if we have actual outputs
                    output: outputs.length > 0 ? [...outputs] : undefined
                  } : cell
                )
              );
              
              // Increment execution counter for next execution
              setExecutionCounter(prevCount => prevCount + 1);
            } else if (status === 'Error') {
              console.log("[DEBUG] Code execution error, setting error state with outputs:", outputs.length);
              
              setCells(prevCells => 
                prevCells.map(cell => 
                  cell.id === cellId ? {
                    ...cell, 
                    executionState: 'error' as ExecutionState,
                    // Only set output if we have actual outputs
                    output: outputs.length > 0 ? [...outputs] : undefined
                  } : cell
                )
              );
            }
          }
        });
        
        // Return the short output if available, otherwise a generic success message
        return shortOutput.trim() || "Code executed successfully. No output generated.";
      } catch (error) {
        console.error("[DEBUG] executeCode error:", error);
        
        // If error during execution, still mark the cell with error state
        setCells(prevCells => 
          prevCells.map(cell => 
            cell.id === cellId ? {
              ...cell,
              executionState: 'error' as ExecutionState,
              output: [{
                type: 'stderr',
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                attrs: { className: 'output-area error-output' }
              }]
            } : cell
          )
        );
        
        return `Error executing code: ${error instanceof Error ? error.message : String(error)}`;
      }
    } catch (error) {
      console.error("[DEBUG] Fatal error in handleExecuteCode:", error);
      return `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, [addCell, executeCode, setCells, updateCellExecutionState, executionCounter]);

  // Use the proper custom hook to register tools
  const { tools, isToolRegistered } = useNotebookTools(isReady, executeCode, handleExecuteCode);

  // Handle agent responses
  const handleAgentResponse = useCallback((item: any) => {
    console.log('[DEBUG] Handling agent response:', JSON.stringify(item, null, 2).substring(0, 500) + '...');
    
    if (item.type === 'message' && item.role === 'assistant') {
      setIsProcessingAgentResponse(true);
      
      try {
        // Process each content item in the message
        if (item.content && item.content.length > 0) {
          // Track if we have any tool calls to handle
          let hasToolCalls = false;
          let lastAddedCellId = '';
          
          console.log('[DEBUG] Processing message content items:', item.content.length);
          
          item.content.forEach((contentItem: any, index: number) => {
            console.log(`[DEBUG] Content item ${index} type:`, contentItem.type);
            
            if (contentItem.type === 'text' || contentItem.type === 'markdown') {
              console.log('[DEBUG] Adding markdown cell from text/markdown content');
              // Add as markdown cell with assistant role
              lastAddedCellId = addCell('markdown', contentItem.text || contentItem.content, 'assistant');
            } else if (contentItem.type === 'tool_call' && contentItem.content) {
              // This will be handled by the tool registration system
              // The code will be added and executed through the handleExecuteCode function
              console.log('[DEBUG] Tool call from agent:', JSON.stringify(contentItem, null, 2));
              
              if (contentItem.content.name === 'runCode') {
                console.log('[DEBUG] runCode tool call detected with args:', 
                  JSON.stringify(contentItem.content.args, null, 2).substring(0, 200) + '...');
              }
              
              hasToolCalls = true;
            } else {
              console.log('[DEBUG] Unhandled content item type:', contentItem.type, contentItem);
            }
          });
          
          // If this message contained tool calls but no response was sent back,
          // handle the case to prevent the "tool_call_id did not have response messages" error
          if (hasToolCalls) {
            console.log('[DEBUG] Message contained tool calls, ensuring responses are sent');
          }
          
          // Scroll to the last added cell after a short delay to ensure rendering is complete
          if (lastAddedCellId) {
            setTimeout(() => {
              const cellElement = document.querySelector(`[data-cell-id="${lastAddedCellId}"]`);
              if (cellElement) {
                cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log('[DEBUG] Scrolled to newly added cell:', lastAddedCellId);
              }
            }, 100);
          }
        } else {
          console.log('[DEBUG] No content items in message');
        }
      } catch (error) {
        console.error('[DEBUG] Error processing agent response:', error);
      } finally {
        setIsProcessingAgentResponse(false);
      }
    } else {
      console.log('[DEBUG] Ignoring non-assistant message:', item.type, item.role);
    }
  }, [addCell]);

  // Initialize schema-agents
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    const initSchemaAgents = async () => {
      if (!server || !isMounted) return;
      
      // Check if user is logged in
      if (!isLoggedIn) {
        setInitializationError("You must be logged in to use the AI assistant. Please log in and try again.");
        return;
      }
      
      try {
        console.log('Attempting to initialize schema-agents service...');
        const service = await server.getService("schema-agents");
        
        if (isMounted) {
          if (service) {
            console.log('Schema-agents service initialized successfully');
            setSchemaAgents(service);
          } else {
            console.error('Schema-agents service returned null');
            setInitializationError("Could not connect to the AI service. Please check your connection.");
            retryIfNeeded();
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to initialize schema-agents:', error);
          setInitializationError("Error connecting to AI service: " + 
            (error instanceof Error ? error.message : "Unknown error"));
          retryIfNeeded();
        }
      }
    };
    
    const retryIfNeeded = () => {
      if (retryCount < MAX_RETRIES && isMounted) {
        retryCount++;
        console.log(`Retrying schema-agents initialization (attempt ${retryCount}/${MAX_RETRIES})...`);
        setTimeout(initSchemaAgents, 2000); // Wait 2 seconds before retrying
      } else if (isMounted) {
        // Max retries reached
        setInitializationError("Failed to connect to AI service after multiple attempts. Please refresh the page to try again.");
      }
    };

    initSchemaAgents();
    
    return () => {
      isMounted = false;
    };
  }, [server, isLoggedIn]);

  // Auto start chat when ready
  useEffect(() => {
    // Keep track of whether component is mounted
    let isMounted = true;
    
    // Add a timeout for initialization
    const initTimeout = setTimeout(() => {
      if (isMounted && !isChatRunning) {
        console.warn('AI assistant initialization is taking longer than expected. Will continue to try in the background.');
        setInitializationError("AI assistant initialization is taking longer than expected. Still trying...");
      }
    }, 8000);
    
    const startAgentChat = async () => {
      // Skip if already recording/initialized or missing dependencies
      if (!isReady || !schemaAgents || isChatRunning || !isMounted || !isLoggedIn) {
        console.log('Skipping chat initialization:', {
          isReady,
          hasSchemaAgents: !!schemaAgents,
          isChatRunning,
          isMounted,
          isLoggedIn
        });
        return;
      }
      
      // Make sure tools are available
      if (!tools || tools.length === 0) {
        console.log('No tools available yet, waiting for tools to be registered...');
        setInitializationError("Waiting for code tools to be registered...");
        setTimeout(() => {
          if (isMounted && !isChatRunning) {
            startAgentChat(); // Try again after tools are hopefully registered
          }
        }, 1000);
        return;
      }
      
      // Ensure the runCode tool is registered
      const hasRunCodeTool = tools.some(tool => tool.name === 'runCode');
      if (!hasRunCodeTool) {
        console.warn('runCode tool not found in registered tools. Available tools:', 
          tools.map(t => t.name)
        );
        setInitializationError("Code execution tool not available. Please try refreshing the page.");
        return;
      }
      
      try {
        console.log('Starting notebook agent chat with config:', {
          model: defaultAgentConfig.model,
          temperature: defaultAgentConfig.temperature,
          toolCount: tools.length,
          toolNames: tools.map(t => t.name)
        });
        
        // Clear any previous error
        if (initializationError) {
          setInitializationError(null);
        }
        
        // Convert existing cells to chat history
        const chatHistory = convertCellsToHistory(cells);
        console.log('Generated chat history from cells:', chatHistory);
        
        await startChat({
          onItemCreated: handleAgentResponse,
          instructions: defaultAgentConfig.instructions,
          temperature: defaultAgentConfig.temperature,
          tools: tools,
          model: defaultAgentConfig.model,
          // chatHistory: chatHistory
        });
        
        console.log('Chat initialization completed successfully');
      } catch (error) {
        // Only log error if component is still mounted
        if (isMounted) {
          console.error('Failed to start agent chat:', error);
          setInitializationError("Could not connect to the AI assistant. Will retry automatically.");
          
          // After a short delay, try again
          setTimeout(() => {
            if (isMounted && !isChatRunning) {
              console.log('Retrying chat initialization...');
              startAgentChat();
            }
          }, 3000);
        }
      }
    };

    // Only start chat if not already recording and we have all dependencies
    if (!isChatRunning && isReady && schemaAgents && isLoggedIn && tools?.length > 0) {
      console.log('Starting chat initialization...');
      startAgentChat();
    }
    
    // Clean up when component unmounts
    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
    };
  }, [isReady, schemaAgents, isLoggedIn, tools]); // Remove isChatRunning from dependencies

  // Handle user input from the chat input component
  const handleSendMessage = (message: string) => {
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

    // Add as a rendered markdown cell with user role
    const cellId = addCell('markdown', message, 'user');
    
    // Scroll to the user message
    setTimeout(() => {
      const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    
    // Send to agent
    if (isChatRunning) {
      try {
        sendText(message);
      } catch (error) {
        console.error('Error sending message to AI:', error);
        setInitializationError("Error communicating with AI assistant. Please try again or refresh the page.");
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
        newCellId = addCell('code', content, 'user');
        break;
        
      case '/markdown':
      case '#markdown':
        // Add new markdown cell with content if provided
        newCellId = addCell('markdown', content, 'user');
        break;
        
      case '/clear':
        // Clear all cells
        hasInitialized.current = true; // Prevent auto-initialization
        setCells([]); // Clear all cells
        // Add a single empty code cell after clearing
        setTimeout(() => {
          const cellId = addCell('code', '', 'user');
          const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`);
          if (cellElement) {
            cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return; // Exit early since we handle scrolling separately
        
      case '/run':
        // Run all cells
        runAllCells();
        break;
        
      default:
        // If command not recognized, treat as markdown content
        newCellId = addCell('markdown', command, 'user');
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

  // Delete a cell by ID with active cell tracking
  const deleteCell = useCallback((id: string) => {
    setCells(prev => {
      const index = prev.findIndex(cell => cell.id === id);
      if (index === -1) return prev;

      const newCells = prev.filter(cell => cell.id !== id);
      
      // Update active cell if needed
      if (id === activeCellId) {
        // Try to activate the next cell, or the previous if there is no next
        const nextIndex = Math.min(index, newCells.length - 1);
        if (nextIndex >= 0) {
          const nextCell = newCells[nextIndex];
          setActiveCellId(nextCell.id);
          // Focus the newly activated cell
          setTimeout(() => {
            const editor = editorRefs.current[nextCell.id]?.current;
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
                toggleCellEditing(nextCell.id, true);
                if (typeof editor.focus === 'function') {
                  editor.focus();
                } else if (editor.getContainerDomNode) {
                  editor.getContainerDomNode()?.focus();
                }
              }
            }
          }, 100);
        } else {
          setActiveCellId(null);
        }
      }

      return newCells;
    });
  }, [activeCellId]);

  // Store function references to break circular dependencies
  const functionRefs = useRef({
    runAllCells: async () => {
      // Set global execution state
      setIsExecuting(true);
      
      for (const cell of cells) {
        if (cell.type === 'code') {
          // Add cell to executing cells set
          setExecutingCells(prev => {
            const newSet = new Set(prev);
            newSet.add(cell.id);
            return newSet;
          });
          
          await executeCell(cell.id);
        }
      }
      
      // Clear global execution state when all cells are executed
      setIsExecuting(false);
    }
  });

  // Update function refs when dependencies change
  useEffect(() => {
    functionRefs.current.runAllCells = async () => {
      setIsExecuting(true);
      
      for (const cell of cells) {
        if (cell.type === 'code') {
          setExecutingCells(prev => {
            const newSet = new Set(prev);
            newSet.add(cell.id);
            return newSet;
          });
          
          await executeCell(cell.id);
        }
      }
      
      setIsExecuting(false);
    };
  }, [cells, executeCell, setExecutingCells]);

  // Handle markdown cell rendering
  const handleMarkdownRender = useCallback((id: string) => {
    const cell = cells.find(c => c.id === id);
    if (cell && cell.type === 'markdown') {
      toggleCellEditing(id, false);
    }
  }, [cells, toggleCellEditing]);

  // Add CSS class for active cell
  const handleCellFocus = useCallback((id: string) => {
    // Remove active state from all cells first
    document.querySelectorAll('.notebook-cell-container').forEach(cell => {
      cell.classList.remove('notebook-cell-container-active');
    });
    
    // Add active state to the clicked cell
    const cellElement = document.querySelector(`[data-cell-id="${id}"]`);
    if (cellElement) {
      cellElement.classList.add('notebook-cell-container-active');
    }
    
    setActiveCellId(id);
  }, []);

  // Function to move focus to next cell or create one if at the end
  const moveToNextCell = useCallback((currentCellId: string) => {
    const currentIndex = cells.findIndex(c => c.id === currentCellId);
    if (currentIndex === -1) return;

    if (currentIndex < cells.length - 1) {
      // Move to next existing cell
      const nextCell = cells[currentIndex + 1];
      setActiveCellId(nextCell.id);
      
      // Focus the cell
      const cellElement = document.querySelector(`[data-cell-id="${nextCell.id}"]`);
      if (cellElement) {
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const editor = editorRefs.current[nextCell.id]?.current;
        if (editor) {
          if (nextCell.type === 'code') {
            if (typeof editor.focus === 'function') {
              editor.focus();
            } else if (editor.getContainerDomNode) {
              editor.getContainerDomNode()?.focus();
            }
          } else {
            toggleCellEditing(nextCell.id, true);
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
      const newCellId = addCell('code', '', 'user');
      setActiveCellId(newCellId);
      
      // Focus the new cell
      setTimeout(() => {
        const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
        if (cellElement) {
          cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          const editor = editorRefs.current[newCellId]?.current;
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
  }, [cells, addCell, toggleCellEditing]);

  // Update keyboard event handler to use moveToNextCell
  const handleKeyboardEvent = useCallback((e: KeyboardEvent) => {
    // Only ignore if we're in a text input field (not Monaco editor)
    if (e.target instanceof HTMLInputElement || 
        (e.target instanceof HTMLTextAreaElement && 
         !(e.target.closest('.monaco-editor') || e.target.closest('.notebook-cell-container')))) {
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
      
      const cell = cells.find(c => c.id === cellId);
      if (!cell) return;
      
      if (cell.type === 'code') {
        executeCell(cellId, true); // Execute and move focus
      } else if (cell.type === 'markdown') {
        handleMarkdownRender(cellId);
        moveToNextCell(cellId);
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
          const newCellId = addCell('code', '', 'user');
          setActiveCellId(newCellId);
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
      functionRefs.current.runAllCells();
      return;
    }
  }, [cells, executeCell, handleMarkdownRender, moveToNextCell, addCell]);

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

  // Change cell type
  const changeCellType = (id: string, newType: CellType) => {
    setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { ...cell, type: newType } : cell
      )
    );
  };

  // Run all cells
  const runAllCells = async () => {
    // Set global execution state
    setIsExecuting(true);
    
    for (const cell of cells) {
      if (cell.type === 'code') {
        // Add cell to executing cells set
        setExecutingCells(prev => {
          const newSet = new Set(prev);
          newSet.add(cell.id);
          return newSet;
        });
        
        await executeCell(cell.id);
      }
    }
    
    // Clear global execution state when all cells are executed
    setIsExecuting(false);
  };

  // Clear all outputs
  const clearAllOutputs = () => {
    setCells(prev => prev.map(cell => ({
      ...cell,
      output: undefined,
      executionState: 'idle'
    })));
  };

  // Update cell role
  const updateCellRole = (id: string, role: CellRole) => {
    setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { ...cell, role, metadata: { ...cell.metadata, role } } : cell
      )
    );
  };

  // Restart kernel and clear outputs
  const restartKernel = async () => {
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to restart the kernel? This will clear all outputs and reset the execution state.')) {
      return;
    }
    
    clearAllOutputs();
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

  // Add new function to get current editor content
  const getCurrentCellsContent = () => {
    return cells.map(cell => {
      if (cell.type === 'code') {
        // Get current content from editor ref
        const editorRef = editorRefs.current[cell.id];
        if (editorRef?.current) {
          // For Monaco editor
          if (editorRef.current.getCurrentCode) {
            const currentCode = editorRef.current.getCurrentCode();
            return {
              ...cell,
              content: currentCode
            };
          }
        }
      }
      return cell;
    });
  };

  // Update save function to include current editor content
  const saveNotebook = () => {
    const currentCells = getCurrentCellsContent();
    console.log('[DEBUG] Saving notebook with cells:', currentCells.length);
    saveToLocalStorage(currentCells, notebookMetadata);
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
    const currentCells = getCurrentCellsContent();
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
        
        setNotebookMetadata(notebookData.metadata);
        
        // Find the highest execution count to continue from
        let maxExecutionCount = 0;
        notebookData.cells.forEach(cell => {
          if (cell.executionCount && cell.executionCount > maxExecutionCount) {
            maxExecutionCount = cell.executionCount;
          }
        });
        
        setExecutionCounter(maxExecutionCount + 1);
        
        // Restore cells with their outputs and content
        const restoredCells = notebookData.cells.map(cell => {
          const newId = Date.now().toString(36) + Math.random().toString(36).substring(2);
          console.log(`[DEBUG] Restoring cell ${newId} with content:`, cell.content?.substring(0, 50) + '...');
          
          return {
            ...cell,
            id: newId,
            executionState: cell.executionState || 'idle',
            content: cell.content || '',  // Ensure content is never undefined
            output: cell.output ? cell.output.map(output => ({
              ...output,
              attrs: {
                ...output.attrs,
                className: `output-area ${output.type === 'stderr' ? 'error-output' : ''}`
              }
            })) : undefined,
            role: cell.role || cell.metadata?.role,
            metadata: {
              ...cell.metadata,
              isNew: false
            }
          };
        });

        console.log('[DEBUG] Setting restored cells:', restoredCells.length);
        setCells(restoredCells);

        // After cells are set, update the editor refs
        setTimeout(() => {
          restoredCells.forEach(cell => {
            if (cell.type === 'code') {
              const editorRef = editorRefs.current[cell.id];
              if (editorRef?.current) {
                // For Monaco editor
                if (editorRef.current.setValue) {
                  editorRef.current.setValue(cell.content);
                }
                // For CodeCell component
                else if (editorRef.current.updateContent) {
                  editorRef.current.updateContent(cell.content);
                }
              }
            }
          });
        }, 100);

      } catch (error) {
        console.error('Error loading notebook:', error);
        // TODO: Show error toast
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
  }, [cells, notebookMetadata]);

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
                value={notebookMetadata.title}
                onChange={(e) => setNotebookMetadata(prev => ({ ...prev, title: e.target.value }))}
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
                  onClick={runAllCells}
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
                  onClick={clearAllOutputs}
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
                  onClick={() => addCell('code')}
                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition flex items-center"
                  title="Add code cell (Ctrl/Cmd + B)"
                >
                  <VscCode className="w-4 h-4 mr-1" />
                  <AiOutlinePlus className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => addCell('markdown')}
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
              className={`group relative ${
                cell.executionState === 'error' ? 'border-red-200' : ''
              } ${
                ''
              } mb-1 bg-white overflow-hidden rounded-md ${
                activeCellId === cell.id ? 'notebook-cell-container-active' : ''
              }`}
              onFocus={() => handleCellFocus(cell.id)}
              onClick={() => handleCellFocus(cell.id)}
              tabIndex={0}
            >
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
                        onRoleChange={(role) => updateCellRole(cell.id, role)}
                        onChange={(newCode) => updateCellContent(cell.id, newCode)}
                      />
                    </div>
                  ) : (
                    <MarkdownCell
                      content={cell.content}
                      onChange={(content) => updateCellContent(cell.id, content)}
                      initialEditMode={cell.metadata?.isNew === true}
                      role={cell.role}
                      onRoleChange={(role) => updateCellRole(cell.id, role)}
                      isEditing={cell.metadata?.isEditing || false}
                      onEditingChange={(isEditing) => toggleCellEditing(cell.id, isEditing)}
                      editorRef={getEditorRef(cell.id)}
                      isActive={activeCellId === cell.id}
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
                        onClick={() => changeCellType(cell.id, 'markdown')}
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
                          onClick={() => toggleCellEditing(cell.id, true)}
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
                        onClick={() => changeCellType(cell.id, 'code')}
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCell(cell.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1"
                    title="Delete cell"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-xs">Delete</span>
                  </button>
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