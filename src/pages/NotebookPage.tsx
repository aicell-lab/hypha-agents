import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ThebeProvider, useThebe } from '../components/chat/ThebeProvider';
import { CodeCell } from '../components/notebook/CodeCell';
import { ChatInput } from '../components/chat/ChatInput';
import { OutputItem } from '../components/chat/Chat';
import MarkdownCell from '../components/notebook/MarkdownCell';
import { Dialog } from '@headlessui/react';
import Convert from 'ansi-to-html';
import '../styles/ansi.css';
import '../styles/notebook.css';
import { useHyphaStore } from '../store/hyphaStore';
import { ToolProvider, useTools } from '../components/chat/ToolProvider';
import { JupyterOutput } from '../components/JupyterOutput';
import { chatCompletion } from '../utils/chatCompletion';
// Import icons
import { FaPlay, FaTrash, FaSyncAlt, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner } from 'react-icons/fa';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';
import { CellManager } from './CellManager';
// Add styles for the active cell
import '../styles/notebook.css';
import LoginButton from '../components/LoginButton';

// Add type imports from chatCompletion
import { ChatRole, ChatMessage } from '../utils/chatCompletion';

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
        isNew: false,
        parent: cell.metadata?.parent // Explicitly preserve parent key
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
  const lastUserCellRef = useRef<string | null>(null);
  const lastAgentCellRef = useRef<string | null>(null);
  
  // Add chat agent state
  const { server, isLoggedIn, user } = useHyphaStore();
  const [schemaAgents, setSchemaAgents] = useState<any>(null);
  const [isProcessingAgentResponse, setIsProcessingAgentResponse] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isAIReady, setIsAIReady] = useState(false);
  const [executingCells, setExecutingCells] = useState<Set<string>>(new Set());

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
    setIsProcessingAgentResponse(true);
    
    setExecutingCells((prev: Set<string>) => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });

    await cellManager.executeCell(id, shouldMoveFocus);
    
    setExecutingCells((prev: Set<string>) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      if (newSet.size === 0) {
        setIsProcessingAgentResponse(false);
      }
      return newSet;
    });
  };

  // Update handleExecuteCode to use lastUserCellRef
  const handleExecuteCode = useCallback(async (code: string, cellId?: string): Promise<string> => {
    try {
      let actualCellId = cellId;
      
      if (actualCellId) {
        // Update the existing code cell with the new code
        const existingCell = cellManager.findCell(c => c.id === actualCellId);
        if (!existingCell) {
          console.error('[DEBUG] Cell not found:', actualCellId);
          return `[Cell Id: ${actualCellId}]\n Runtime Error: cell not found`;
        }
        cellManager.updateCellContent(actualCellId, code);
        console.log('[DEBUG] Updated code cell:', actualCellId);
      }
      else {
        // Insert code cell after the agent cell with proper parent reference
        actualCellId = cellManager.addCell(
          'code', 
          code, 
          'assistant', 
          lastAgentCellRef.current || undefined,
          lastUserCellRef.current || undefined
        );
        console.log('[DEBUG] Added code cell:', actualCellId, 'with parent:', lastUserCellRef.current);
        
        // Set the active cell to the new code cell
        cellManager.setActiveCell(actualCellId);
        // Update the lastAgentCellRef to the new code cell
        lastAgentCellRef.current = actualCellId;
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
              // Save final outputs on completion and collapse code if not manually expanded
              cellManager.updateCellExecutionState(actualCellId, 'success', outputs);
              
              // Collapse the code cell after successful execution
              cellManager.collapseCodeCell(actualCellId);
              
              // Save to localStorage after successful execution
              setTimeout(() => {
                cellManager.saveToLocalStorage();
              }, 100);
            } else if (status === 'Error') {
              // Save error outputs and keep code visible
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
        
        // Save error state and output, keep code visible
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
  }, [cellManager, executeCode, lastAgentCellRef, lastUserCellRef]);

  // Use the proper custom hook to register tools
  const { tools, isToolRegistered } = useNotebookTools(isReady, handleExecuteCode);

  // Update initialization effect to just check for server and login
  useEffect(() => {
    let isMounted = true;
    
    const initializeAgent = async () => {
      if (!server || !isLoggedIn) {
        setIsAIReady(false);
        setInitializationError(!isLoggedIn ? "Please log in to use the AI assistant." : "Waiting for server connection...");
        return;
      }

      try {
        const service = await server.getService("schema-agents");
        if (!isMounted) return;

        if (service) {
          setSchemaAgents(service);
          setInitializationError(null);
          setIsAIReady(true);
        } else {
          setIsAIReady(false);
          setInitializationError("Could not connect to the AI service. Please check your connection.");
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('[DEBUG] Failed to initialize schema-agents:', error);
        setIsAIReady(false);
        setInitializationError("Error connecting to AI service: " + 
          (error instanceof Error ? error.message : "Unknown error"));
      }
    };

    initializeAgent();
    
    return () => {
      isMounted = false;
    };
  }, [server, isLoggedIn]);

  // Function to get conversation history up to a specific cell
  const getConversationHistory = useCallback((upToCellId?: string): ChatMessage[] => {
    let relevantCells = cells;
    if (upToCellId) {
      const cellIndex = cells.findIndex(cell => cell.id === upToCellId);
      if (cellIndex !== -1) {
        relevantCells = cells.slice(0, cellIndex);
      }
    }
    return convertCellsToHistory(relevantCells).map(msg => ({
      ...msg,
      role: msg.role as ChatRole
    }));
  }, [cells]);

  // Update handleSendMessage to properly handle parent IDs
  const handleSendMessage = useCallback(async (message: string) => {
    // If not logged in or not ready, show error
    if (!isLoggedIn || !isReady) {
      setInitializationError(!isLoggedIn ? 
        "You must be logged in to use the AI assistant." : 
        "AI assistant is not ready. Please wait.");
      return;
    }

    // If the message starts with / or #, it's a command
    if (message.startsWith('/') || message.startsWith('#')) {
      handleCommand(message);
      return;
    }

    try {
      setIsProcessingAgentResponse(true);

      // Get conversation history up to the user's message
      const normalizedActiveCellId = cellManager.getActiveCellWithChildren();
      const history = getConversationHistory(normalizedActiveCellId || undefined);
      history.push({
        role: 'user',
        content: message,
      });

      // Add a markdown cell with the user's message, after the active cell
      const userCellId = cellManager.addCell('markdown', message, 'user', normalizedActiveCellId || undefined);
      cellManager.setActiveCell(userCellId);
      
      // Update refs to track the new user message
      lastUserCellRef.current = userCellId;

      // Start chat completion
      const completion = chatCompletion({
        messages: history,
        systemPrompt: defaultAgentConfig.instructions,
        tools,
        model: defaultAgentConfig.model,
        temperature: defaultAgentConfig.temperature,
        server,
        maxSteps: 15,
        onToolCall: async (toolCall) => {
          if (toolCall.name === 'runCode') {
            return await handleExecuteCode(toolCall.arguments.code, toolCall.arguments.cell_id);
          }
          return `Tool ${toolCall.name} not implemented`;
        }
      });

      // Process the completion stream
      for await (const item of completion) {
        cellManager.handleAgentResponse(item, lastUserCellRef.current);
      }
    } catch (error) {
      console.error('Error in chat completion:', error);
      setInitializationError("Error communicating with AI assistant. Please try again.");
    } finally {
      setIsProcessingAgentResponse(false);
    }
  }, [activeCellId, cellManager, isReady, isLoggedIn, server, tools, getConversationHistory, handleExecuteCode]);

  // Update handleRegenerateClick to use deleteCellWithChildren and handleSendMessage
  const handleRegenerateClick = async (cellId: string) => {
    if (!isReady || isProcessingAgentResponse) {
      console.log('[DEBUG] Cannot regenerate while processing another response or not ready', 
        { isReady, isProcessingAgentResponse });
      return;
    }

    // Find the user message cell
    const userCell = cellManager.findCell(cell => cell.id === cellId);
    if (!userCell || userCell.role !== 'user') {
      console.error('[DEBUG] Cannot regenerate responses for a non-user cell or cell not found');
      return;
    }
    try {
      setIsProcessingAgentResponse(true);
      // Get the message content and position info before deletion
      const messageContent = userCell.content;
      
      // Find the cell's current index before deletion
      const currentIndex = cells.findIndex(cell => cell.id === cellId);
      const previousCellId = currentIndex > 0 ? cells[currentIndex - 1].id : undefined;
      
      // Delete the cell and its responses first
      cellManager.deleteCellWithChildren(cellId);
      
      // Wait a small tick to ensure deletion is complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Add the new cell at the same position as the old one
      const newCellId = cellManager.addCell(
        'markdown', 
        messageContent, 
        'user', 
        undefined, 
        undefined, 
        currentIndex
      );
      
      lastUserCellRef.current = newCellId;
      cellManager.setActiveCell(newCellId);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const history = getConversationHistory(cellId || undefined);
      history.push({
        role: 'user',
        content: messageContent,
      });
      // Start chat completion
      const completion = chatCompletion({
        messages: history,
        systemPrompt: defaultAgentConfig.instructions,
        tools,
        model: defaultAgentConfig.model,
        temperature: defaultAgentConfig.temperature,
        server,
        maxSteps: 15,
        onToolCall: async (toolCall) => {
          if (toolCall.name === 'runCode') {
            return await handleExecuteCode(toolCall.arguments.code, toolCall.arguments.cell_id);
          }
          return `Tool ${toolCall.name} not implemented`;
        }
      });

      // Process the completion stream
      for await (const item of completion) {
        cellManager.handleAgentResponse(item, lastUserCellRef.current);
      }
    } catch (error) {
      console.error('[DEBUG] Error regenerating responses:', error);
      setInitializationError("Error regenerating response. Please try again.");
    } finally {
      setIsProcessingAgentResponse(false);
    }
  };

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
  }, [cellManager, hasInitialized]);

  // Handle markdown cell rendering
  const handleMarkdownRender = useCallback((id: string) => {
    const cell = cellManager.findCell(c => c.id === id);
    if (cell && cell.type === 'markdown') {
      cellManager.toggleCellEditing(id, false);
    }
  }, [cellManager]);

  // Handle keyboard event handler
  const handleKeyboardEvent = useCallback((e: KeyboardEvent) => {
    // Only ignore if we're in a text input field (not Monaco editor)
    if (e.target instanceof HTMLInputElement || 
        (e.target instanceof HTMLTextAreaElement && 
         !(e.target.closest('.monaco-editor') || e.target.closest('.notebook-cell-container')))) {
      return;
    }

    // Handle arrow key navigation when not in editor
    const isInEditor = e.target instanceof HTMLTextAreaElement || 
                      e.target instanceof HTMLInputElement ||
                      (e.target as HTMLElement)?.classList?.contains('monaco-editor');

    if (!isInEditor) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault(); // Prevent default scrolling
        
        // Find current cell index
        const currentIndex = cells.findIndex(cell => cell.id === activeCellId);
        if (currentIndex === -1) return;
        
        let nextIndex;
        if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
          nextIndex = Math.max(0, currentIndex - 1);
        } else {
          nextIndex = Math.min(cells.length - 1, currentIndex + 1);
        }
        
        // Set active cell and focus it
        const nextCell = cells[nextIndex];
        if (nextCell) {
          cellManager.setActiveCell(nextCell.id);
          const cellElement = document.querySelector(`[data-cell-id="${nextCell.id}"]`);
          if (cellElement) {
            cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        return;
      }
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
          const newCellId = cellManager.addCell('code', '', 'user', cellId);
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
  }, [executeCell, handleMarkdownRender, cellManager, editorRefs, activeCellId, cells]);

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
          trusted: true,
          parent: cell.metadata?.parent // Explicitly preserve parent key
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
              cell.role || (cell.metadata?.role as CellRole | undefined),
              undefined, // afterCellId
              cell.metadata?.parent // Pass the parent ID from metadata
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            {/* Title and Logo */}
            <div className="flex items-center gap-3">
              <Link 
                to="/" 
                className="flex items-center hover:opacity-80 transition"
                title="Go to Home"
              >
                <svg 
                  stroke="currentColor" 
                  fill="currentColor" 
                  strokeWidth="0" 
                  viewBox="0 0 24 24" 
                  className="h-8 w-8 text-blue-600" 
                  height="1em" 
                  width="1em" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="m21.406 6.086-9-4a1.001 1.001 0 0 0-.813 0l-9 4c-.02.009-.034.024-.054.035-.028.014-.058.023-.084.04-.022.015-.039.034-.06.05a.87.87 0 0 0-.19.194c-.02.028-.041.053-.059.081a1.119 1.119 0 0 0-.076.165c-.009.027-.023.052-.031.079A1.013 1.013 0 0 0 2 7v10c0 .396.232.753.594.914l9 4c.13.058.268.086.406.086a.997.997 0 0 0 .402-.096l.004.01 9-4A.999.999 0 0 0 22 17V7a.999.999 0 0 0-.594-.914zM12 4.095 18.538 7 12 9.905l-1.308-.581L5.463 7 12 4.095zM4 16.351V8.539l7 3.111v7.811l-7-3.11zm9 3.11V11.65l7-3.111v7.812l-7 3.11z"></path>
                </svg>
              </Link>
              <div className="h-5 w-px bg-gray-200 mx-1"></div>
              <input
                type="text"
                value={notebookMetadata.title || 'Untitled Notebook'}
                onChange={(e) => setNotebookMetadata(prev => ({ 
                  ...prev, 
                  title: e.target.value || 'Untitled Notebook',
                  modified: new Date().toISOString()
                }))}
                className="text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                placeholder="Untitled Notebook"
              />
            </div>

            {/* Action buttons in a single row */}
            <div className="flex items-center gap-1">
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
                  className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition cursor-pointer flex items-center"
                  title="Open notebook"
                >
                  <FaFolder className="w-3.5 h-3.5" />
                </label>
                <button
                  onClick={saveNotebook}
                  className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                  title="Save notebook (Ctrl/Cmd + S)"
                >
                  <FaSave className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={downloadNotebook}
                  className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                  title="Download notebook (Ctrl/Cmd + Shift + S)"
                >
                  <FaDownload className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => cellManager.runAllCells()}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                  title="Run all cells (Ctrl/Cmd + Shift + Enter)"
                  disabled={isProcessingAgentResponse}
                >
                  {isProcessingAgentResponse ? (
                    <FaSpinner className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FaPlay className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => cellManager.clearAllOutputs()}
                  className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
                  title="Clear all outputs"
                  disabled={isProcessingAgentResponse}
                >
                  <FaTrash className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={restartKernel}
                  className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition group relative"
                  title="Restart kernel and clear outputs"
                  disabled={!isReady || isProcessingAgentResponse}
                >
                  <FaRedo className={`w-3.5 h-3.5 ${(!isReady || isProcessingAgentResponse) ? 'opacity-50' : ''}`} />
                </button>
              </div>

              <div className="flex items-center ml-1 border-l border-gray-200 pl-1">
                <button 
                  onClick={() => {
                    const afterId = activeCellId ? activeCellId : undefined;
                    const newCellId = cellManager.addCell('code', '', 'user', afterId);
                    // Focus the new cell
                    setTimeout(() => {
                      const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
                      if (cellElement) {
                        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 100);
                  }}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition flex items-center"
                  title="Add code cell (Ctrl/Cmd + B)"
                >
                  <VscCode className="w-3.5 h-3.5" />
                  <AiOutlinePlus className="w-2.5 h-2.5 ml-0.5" />
                </button>
                <button 
                  onClick={() => {
                    const afterId = activeCellId ? activeCellId : undefined;
                    const newCellId = cellManager.addCell('markdown', '', 'user', afterId);
                    // Focus the new cell
                    setTimeout(() => {
                      const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
                      if (cellElement) {
                        cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 100);
                  }}
                  className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition flex items-center"
                  title="Add markdown cell"
                >
                  <MdOutlineTextFields className="w-3.5 h-3.5" />
                  <AiOutlinePlus className="w-2.5 h-2.5 ml-0.5" />
                </button>
                <button
                  onClick={() => setIsShortcutsDialogOpen(true)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition ml-1"
                  title="Keyboard Shortcuts"
                >
                  <FaKeyboard className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add login button section */}
              <div className="flex items-center ml-1 border-l border-gray-200 pl-1">
                <LoginButton className="scale-75 z-100" />
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
                        parent={cell.metadata?.parent}
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
                    <div className={`jupyter-cell-flex-container mt-1 ${cell.metadata?.parent ? 'child-cell' : 'parent-cell'}`}>
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
                      disabled={!isReady || isProcessingAgentResponse}
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
                              cellManager.deleteCellWithChildren(cell.id);
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
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm pt-1 px-4 pb-4 shadow-md z-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-2 text-xs text-center">
            {!isLoggedIn ? (
              <p className="text-yellow-800">Please log in to use the AI assistant</p>
            ) : (
              <p className="text-gray-500">
                {isProcessingAgentResponse ? "AI is thinking..." : 
                initializationError ? initializationError :
                !isAIReady ? "Initializing AI assistant..." :
                "Ask a question or use commands like /code or /markdown to add specific cell types"}
              </p>
            )}
            {initializationError && !isAIReady && isLoggedIn && (
              <button 
                onClick={async () => {
                  try {
                    setInitializationError(null);
                    const service = await server.getService("schema-agents");
                    if (service) {
                      setSchemaAgents(service);
                      setInitializationError(null);
                      setIsAIReady(true);
                    } else {
                      setIsAIReady(false);
                      setInitializationError("Could not connect to the AI service. Please check your connection.");
                    }
                  } catch (error: unknown) {
                    console.error('[DEBUG] Failed to initialize schema-agents:', error);
                    setIsAIReady(false);
                    setInitializationError("Error connecting to AI service: " + 
                      (error instanceof Error ? error.message : "Unknown error"));
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
            disabled={!isAIReady || isProcessingAgentResponse || !isLoggedIn}
            isThebeReady={isReady}
            placeholder={
              !isLoggedIn ? "Please log in to use the AI assistant" :
              !isAIReady ? "Initializing AI assistant..." : 
              initializationError ? "AI assistant connection failed..." :
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
      <NotebookPage />
    </ToolProvider>
  </ThebeProvider>
);

export default NotebookPageWithThebe; 