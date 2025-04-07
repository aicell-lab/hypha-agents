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
import { structuredChatCompletion } from '../utils/chatCompletion';
import { NotebookToolbar } from '../components/notebook/NotebookToolbar';
// Import icons
import { FaPlay, FaTrash, FaSyncAlt, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner, FaCopy } from 'react-icons/fa';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';
import { CellManager } from './CellManager';
// Add styles for the active cell
import '../styles/notebook.css';
import { AgentSettings } from '../utils/chatCompletion';
import { loadSavedAgentSettings } from '../components/chat/AgentSettingsPanel';
import { CanvasPanel } from '../components/notebook/CanvasPanel';
import { setupNotebookService, HyphaCoreWindow } from '../components/services/hyphaCoreServices';

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

interface NotebookData {
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

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

const stripAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');


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

// Add default agent configuration


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
  const { isReady, executeCode, restartKernel } = useThebe();
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const hasInitialized = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const [notebookMetadata, setNotebookMetadata] = useState<NotebookMetadata>(defaultNotebookMetadata);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const editorRefs = useRef<{ [key: string]: React.RefObject<any> }>({});
  const lastUserCellRef = useRef<string | null>(null);
  const lastAgentCellRef = useRef<string | null>(null);
  // Add state for system prompts visibility
  const [showSystemPrompts, setShowSystemPrompts] = useState(false);

  // Add chat agent state
  const { server, isLoggedIn } = useHyphaStore();
  const [isProcessingAgentResponse, setIsProcessingAgentResponse] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isAIReady, setIsAIReady] = useState(false);
  // Add state for agent settings with proper initialization from localStorage
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => loadSavedAgentSettings());
  const [hyphaCoreApi, setHyphaCoreApi] = useState<any>(null);
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

  // Update side panel state names
  const [canvasPanelWidth, setCanvasPanelWidth] = useState(600);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);
  const [hyphaCoreWindows, setHyphaCoreWindows] = useState<HyphaCoreWindow[]>([]);
  const [activeCanvasTab, setActiveCanvasTab] = useState<string | null>(null);

  const addWindowCallback = useCallback((config: any) => {
    // Add the new window to our state
    const newWindow: HyphaCoreWindow = {
      id: config.window_id,
      src: config.src,
      name: config.name || `${config.src || 'Untitled Window'}`
    };
    
    setHyphaCoreWindows(prev => [...prev, newWindow]);
    setShowCanvasPanel(true);
    setActiveCanvasTab(config.window_id);
  }, [setHyphaCoreWindows, setShowCanvasPanel, setActiveCanvasTab]);

  const handleTabClose = useCallback((tabId: string) => {
    setHyphaCoreWindows(prev => {
      const newWindows = prev.filter(w => w.id !== tabId);
      if (newWindows.length === 0) {
        setShowCanvasPanel(false);
        setActiveCanvasTab(null);
      } else if (activeCanvasTab === tabId) {
        // Set the last window as active when closing the active tab
        setActiveCanvasTab(newWindows[newWindows.length - 1].id);
      }
      return newWindows;
    });
  }, [activeCanvasTab]);

  // Update the useEffect to use the imported setupNotebookService
  useEffect(() => {
    if (server && isLoggedIn && !hyphaCoreApi) {
      console.log("HyphaCore is ready");
      // Create a stable reference to executeCode that won't change
      const setupService = async () => {
        try {
          const api = await setupNotebookService({
            onAddWindow: addWindowCallback,
            server,
            executeCode,
          });
          setHyphaCoreApi(api);
        } catch (error) {
          console.error("Failed to setup notebook service:", error);
        }
      };
      if (isReady && server && isLoggedIn) {
        setupService();
      }
    }
  }, [server, isLoggedIn, addWindowCallback, isReady]); // Remove executeCode from dependencies

  // Load saved state on mount
  useEffect(() => {
    const loadInitialState = async () => {
      if (!hasInitialized.current) {
        try {
          const savedState = await cellManager.loadFromLocalStorage();
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
        } catch (error) {
          console.error('Error loading initial state:', error);
          // Add welcome cells as fallback
          cellManager.addCell('markdown', `# 🚀 Welcome to the Interactive Notebook\n\nThis notebook combines the power of Jupyter notebooks with AI assistance.\n\n* Type your question or request in the chat input below\n* Add code cells with \`/code\` command\n* Add markdown cells with \`/markdown\` command\n* Run cells with the run button or Ctrl+Enter`, 'assistant');
          cellManager.addCell('code', '', 'assistant');
          hasInitialized.current = true;
        }
      }
    };

    loadInitialState();
  }, [cellManager]);

  // Update auto-save effect to use a debounce
  useEffect(() => {
    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer with longer delay
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await cellManager.saveToLocalStorage();
      } catch (error) {
        console.error('Error auto-saving notebook:', error);
      }
    }, 2000); // Increased delay to 2 seconds

    // Cleanup timer on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [cells, notebookMetadata, cellManager]);


  // Update handleExecuteCode to use lastUserCellRef
  const handleExecuteCode = useCallback(async (code: string, cellId?: string): Promise<string> => {
    try {
      setIsProcessingAgentResponse(true);
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
          cellManager.getCurrentAgentCell() || undefined,
          lastUserCellRef.current || undefined
        );
        console.log('[DEBUG] Added code cell:', actualCellId, 'with parent:', lastUserCellRef.current);
        //collapse the code cell
        cellManager.collapseCodeCell(actualCellId);
        // Set the active cell to the new code cell
        cellManager.setActiveCell(actualCellId);
        cellManager.setCurrentAgentCell(actualCellId);

      }
      // wait for the next tick
      await new Promise(resolve => setTimeout(resolve, 0));
      return await cellManager.executeCell(actualCellId, true);
    } catch (error) {
      console.error("[DEBUG] Fatal error in handleExecuteCode:", error);
      return `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    }
    finally {
      setIsProcessingAgentResponse(false);
    }
  }, [cellManager, executeCode, lastAgentCellRef, lastUserCellRef]);

  // Update initialization effect to just check for server and login
  useEffect(() => {
    let isMounted = true;
    setInitializationError(null);
    setIsAIReady(true);

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
        relevantCells = cells.slice(0, cellIndex + 1);
      }
    }
    return cellManager.convertCellsToHistory(relevantCells).map(msg => ({
      ...msg,
      role: msg.role as ChatRole
    }));
  }, [cells]);

  // Update handleSendMessage to use agent settings
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

      const normalizedActiveCellId = cellManager.getActiveCellWithChildren();
      const history = getConversationHistory(normalizedActiveCellId || undefined);
      history.push({
        role: 'user',
        content: message,
      });

      const userCellId = cellManager.addCell('markdown', message, 'user', normalizedActiveCellId || undefined);
      cellManager.setActiveCell(userCellId);
      cellManager.setCurrentAgentCell(userCellId);
      lastUserCellRef.current = userCellId;

      // Use agent settings in chat completion
      const completion = structuredChatCompletion({
        messages: history,
        systemPrompt: agentSettings.instructions,
        model: agentSettings.model,
        temperature: agentSettings.temperature,
        maxSteps: 15,
        baseURL: agentSettings.baseURL,
        apiKey: agentSettings.apiKey,
        onToolCall: async (toolCall) => {
          if (toolCall.name === 'runCode') {
            return await handleExecuteCode(toolCall.arguments.code, toolCall.arguments.cell_id);
          }
          return `Tool ${toolCall.name} not implemented`;
        },
        onMessage: (completionId: string, message: string) => {
          console.debug('[DEBUG] New Message:', completionId, message);
          cellManager.updateCellById(
            completionId,
            message,
            'markdown',
            'assistant',
            lastUserCellRef.current || undefined
          );
        }
      });

      // Process the completion stream
      for await (const item of completion) {
        console.debug('[DEBUG] New Response Item:', item);
      }
    } catch (error) {
      console.error('Error in chat completion:', error);
      setInitializationError("Error communicating with AI assistant. Please try again.");
    } finally {
      setIsProcessingAgentResponse(false);
    }
  }, [activeCellId, cellManager, isReady, isLoggedIn, server, getConversationHistory, handleExecuteCode, agentSettings]);



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
      cellManager.setCurrentAgentCell(newCellId);

      await new Promise(resolve => setTimeout(resolve, 0));

      const history = getConversationHistory(cellId || undefined);

      // Start chat completion
      const completion = structuredChatCompletion({
        messages: history,
        systemPrompt: agentSettings.instructions,
        model: agentSettings.model,
        temperature: agentSettings.temperature,
        maxSteps: 15,
        baseURL: agentSettings.baseURL,
        apiKey: agentSettings.apiKey,
        onToolCall: async (toolCall) => {
          if (toolCall.name === 'runCode') {
            return await handleExecuteCode(toolCall.arguments.code, toolCall.arguments.cell_id);
          }
          return `Tool ${toolCall.name} not implemented`;
        },
        onMessage: (completionId: string, message: string) => {
          console.debug('[DEBUG] New Message:', message);
          cellManager.updateCellById(
            completionId,
            message,
            'markdown',
            'assistant',
            lastUserCellRef.current || undefined
          );
        }
      });

      // Process the completion stream
      for await (const item of completion) {
        console.debug('[DEBUG] New Response Item:', item);
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
        cellManager.executeCell(cellId, true); // Execute and move focus
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
          cellManager.executeCell(cellId, false);
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
  }, [handleMarkdownRender, cellManager, editorRefs, activeCellId, cells]);

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
  const handleRestartKernel = async () => {
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to restart the kernel? This will clear all outputs and reset the execution state.')) {
      return;
    }
    // clear running state for all cells
    cellManager.clearAllOutputs();
    setExecutionCounter(1);
    await restartKernel();
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

        // Create a mapping of old cell IDs to new cell IDs
        const idMapping: { [oldId: string]: string } = {};

        // Add a small delay to ensure cells are cleared before adding new ones
        setTimeout(() => {
          // First pass: Create all cells and build ID mapping
          notebookData.cells.forEach((cell) => {
            const oldId = cell.id;
            const newCellId = cellManager.addCell(
              cell.type,
              cell.content || '',
              cell.role || (cell.metadata?.role as CellRole | undefined)
            );
            idMapping[oldId] = newCellId;
          });

          // Second pass: Update parent references and other cell properties
          notebookData.cells.forEach((cell, index) => {
            const newCellId = idMapping[cell.id];
            if (!newCellId) return;

            // Update parent reference if it exists
            if (cell.metadata?.parent) {
              const newParentId = idMapping[cell.metadata.parent];
              if (newParentId) {
                cellManager.updateCellMetadata(newCellId, {
                  ...cell.metadata,
                  parent: newParentId
                });
              }
            }

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

              cellManager.updateCellExecutionState(newCellId, executionState, outputs);
            }

            // Set code visibility based on metadata
            if (cell.type === 'code' && cell.metadata?.isCodeVisible === false) {
              cellManager.toggleCodeVisibility(newCellId);
            }

            // If it's the last cell, make it active
            if (index === notebookData.cells.length - 1) {
              cellManager.setActiveCell(newCellId);
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

  // Add copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show a brief success message
      const messageDiv = document.createElement('div');
      messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
      messageDiv.textContent = 'Copied to clipboard';
      document.body.appendChild(messageDiv);
      setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(messageDiv), 500);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // run system cells on startup
  useEffect(() => {
    const systemCells = cells.filter(cell => cell.role === 'system' && cell.type === 'code');
    // Only execute the first system cell
    if (systemCells.length > 0) {
      const systemCellId = systemCells[0].id;
      // show the code of the system cell
      cellManager.showCode(systemCellId);
      cellManager.executeCell(systemCellId, false).then(() => {
        setTimeout(() => {
          // hide the code and the output of the system cell
          cellManager.hideCellOutput(systemCellId);
          cellManager.hideCode(systemCellId);
        }, 1000);
      }).catch((error) => {
        // hide the code and show the output of the system cell
        cellManager.showCellOutput(systemCellId);
        cellManager.hideCode(systemCellId);
        console.error('Error executing system cell:', error);
      });
    }
  }, [isReady, cellManager]);

  // Add toggleOutputVisibility method to cellManager
  const toggleOutputVisibility = (id: string) => {
    setCells((prev) =>
      prev.map((cell) => {
        if (cell.id === id) {
          const currentVisibility = cell.metadata?.isOutputVisible !== false; // if undefined, treat as visible
          return {
            ...cell,
            metadata: {
              ...cell.metadata,
              isOutputVisible: !currentVisibility,
              userModified: true, // Mark that user has manually changed visibility
            },
          };
        }
        return cell;
      })
    );
  };

  // Add function to toggle system prompts visibility
  const toggleSystemPrompts = useCallback(() => {
    setShowSystemPrompts(prev => !prev);
    // Update visibility of all system cells
    setCells(prev => prev.map(cell => {
      if (cell.role === 'system') {
        return {
          ...cell,
          metadata: {
            ...cell.metadata,
            isCodeVisible: !showSystemPrompts,
            isOutputVisible: !showSystemPrompts
          }
        };
      }
      return cell;
    }));
  }, [showSystemPrompts]);

  return (
    <div className="flex h-screen overflow-hidden">
    {/* Main notebook content */}
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-2">
          <div className="max-w-full mx-auto flex items-center justify-between">
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

            <NotebookToolbar
              onSave={saveNotebook}
              onDownload={downloadNotebook}
              onLoad={loadNotebook}
              onRunAll={() => cellManager.runAllCells()}
              onClearOutputs={() => cellManager.clearAllOutputs()}
              onRestartKernel={handleRestartKernel}
              onAddCodeCell={() => {
                const afterId = activeCellId ? activeCellId : undefined;
                const newCellId = cellManager.addCell('code', '', 'user', afterId);
                setTimeout(() => {
                  const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
                  if (cellElement) {
                    cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              }}
              onAddMarkdownCell={() => {
                const afterId = activeCellId ? activeCellId : undefined;
                const newCellId = cellManager.addCell('markdown', '', 'user', afterId);
                setTimeout(() => {
                  const cellElement = document.querySelector(`[data-cell-id="${newCellId}"]`);
                  if (cellElement) {
                    cellElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              }}
              onShowKeyboardShortcuts={() => setIsShortcutsDialogOpen(true)}
              onToggleSystemPrompts={toggleSystemPrompts}
              showSystemPrompts={showSystemPrompts}
              onToggleCanvasPanel={() => setShowCanvasPanel(!showCanvasPanel)}
              showCanvasPanel={showCanvasPanel}
              isProcessing={isProcessingAgentResponse}
              isReady={isReady}
            />
          </div>
        </div>
      </div>

      {/* Main content area with notebook and canvas panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Notebook Content Area */}
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden py-1 pb-48">
          <div className="max-w-5xl mx-auto px-4 notebook-cells-container bg-gray-100">
            {cells.map((cell, index) => (
              <div
                key={cell.id}
                data-cell-id={cell.id}
                className={`notebook-cell-container group relative ${cell.executionState === 'error' ? 'border-red-200' : ''
                  } ${activeCellId === cell.id ? 'notebook-cell-container-active' : ''
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
                      
                        <CodeCell
                          code={cell.content}
                          language="python"
                          onExecute={() => cellManager.executeCell(cell.id)}
                          isExecuting={cell.executionState === 'running'}
                          executionCount={cell.executionState === 'running' ? undefined : cell.executionCount}
                          blockRef={getEditorRef(cell.id)}
                          isActive={activeCellId === cell.id}
                          role={cell.role}
                          onRoleChange={(role) => cellManager.updateCellRole(cell.id, role)}
                          onChange={(newCode) => cellManager.updateCellContent(cell.id, newCode)}
                          hideCode={cell.metadata?.isCodeVisible === false}
                          onVisibilityChange={() => cellManager.toggleCodeVisibility(cell.id)}
                          hideOutput={cell.metadata?.isOutputVisible === false}
                          onOutputVisibilityChange={() => cellManager.toggleOutputVisibility(cell.id)}
                          parent={cell.metadata?.parent}
                          output={cell.output}
                        />
               
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
                  </div>

                  {/* Cell Toolbar - Show on hover */}
                  <div
                    className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded px-1 z-10 hover:opacity-100"
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
                        {/* Add Copy Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(cell.content);
                          }}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                          title="Copy code"
                        >
                          <FaCopy className="w-3.5 h-3.5" />
                          <span className="text-xs">Copy</span>
                        </button>

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
                          onClick={() => cellManager.executeCell(cell.id)}
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
                          <>

                            {/* Add Copy Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(cell.content);
                              }}
                              className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                              title="Copy markdown"
                            >
                              <FaCopy className="w-3.5 h-3.5" />
                              <span className="text-xs">Copy</span>
                            </button>
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

                          </>
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

        {/* Canvas Panel */}
        {showCanvasPanel && (
          <div className="border-l border-gray-200 h-full relative" style={{ width: canvasPanelWidth }}>
            <CanvasPanel
              windows={hyphaCoreWindows}
              isVisible={showCanvasPanel}
              width={canvasPanelWidth}
              activeTab={activeCanvasTab}
              onResize={setCanvasPanelWidth}
              onClose={() => setShowCanvasPanel(false)}
              onTabChange={setActiveCanvasTab}
              onTabClose={handleTabClose}
            />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm pt-1 px-4 pb-4 shadow-md z-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-2 text-xs text-center">
            {!isLoggedIn ? (
              <p className="text-yellow-800">Please log in to use the AI assistant</p>
            ) : (
              <p className="text-gray-500">
                {isProcessingAgentResponse ? (
                  <span className="flex items-center justify-center gap-2">
                    <FaSpinner className="animate-spin h-4 w-4" />
                    AI is thinking...
                  </span>
                ) : initializationError ? initializationError :
                  !isAIReady ? "Initializing AI assistant..." :
                    "Ask a question or use commands like /code or /markdown to add specific cell types"}
              </p>
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
            agentSettings={agentSettings}
            onSettingsChange={setAgentSettings}
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={isShortcutsDialogOpen}
        onClose={() => setIsShortcutsDialogOpen(false)}
      />
    </div>
     </div>
     </div>
  );
};

const NotebookPageWithThebe: React.FC = () => {
  return (
    <ThebeProvider>
      <ToolProvider>
            <NotebookPage />
         
      </ToolProvider>
    </ThebeProvider>
  );
};

export default NotebookPageWithThebe; 