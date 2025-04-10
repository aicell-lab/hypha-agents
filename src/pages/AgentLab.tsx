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
import { FaPlay, FaTrash, FaSyncAlt, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner, FaCopy, FaCheckCircle, FaUndo } from 'react-icons/fa';
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
import ThinkingCell from '../components/notebook/ThinkingCell';

// Add type imports from chatCompletion
import { ChatRole, ChatMessage } from '../utils/chatCompletion';

// Import components
import NotebookHeader from '../components/notebook/NotebookHeader';
import NotebookContent from '../components/notebook/NotebookContent';
import NotebookFooter from '../components/notebook/NotebookFooter';
import KeyboardShortcutsDialog from '../components/notebook/KeyboardShortcutsDialog';

// Import utilities and types
import { NotebookCell, NotebookData, NotebookMetadata, defaultNotebookMetadata, CellType, CellRole } from '../types/notebook';
import { showToast, downloadNotebook } from '../utils/notebookUtils';

// Import hooks
import { useChatCompletion } from '../hooks/useChatCompletion';
import { useNotebookCommands } from '../hooks/useNotebookCommands';

// Add imports for Sidebar components
import Sidebar from '../components/notebook/Sidebar';

const convert = new Convert({
  fg: '#000',
  bg: '#fff',
  newline: true,
  escapeXML: true,
  stream: false
});

const NotebookPage: React.FC = () => {
  const navigate = useNavigate();
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [executionCounter, setExecutionCounter] = useState(1);
  const { isReady, executeCode, restartKernel } = useThebe();
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const hasInitialized = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const systemCellsExecutedRef = useRef(false);
  const [notebookMetadata, setNotebookMetadata] = useState<NotebookMetadata>(defaultNotebookMetadata);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const editorRefs = useRef<{ [key: string]: React.RefObject<any> }>({});
  const lastUserCellRef = useRef<string | null>(null);
  const lastAgentCellRef = useRef<string | null>(null);
  const { server, isLoggedIn } = useHyphaStore();
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isAIReady, setIsAIReady] = useState(false);
  const [agentSettings, setAgentSettings] = useState(() => loadSavedAgentSettings());
  const [hyphaCoreApi, setHyphaCoreApi] = useState<any>(null);

  const [canvasPanelWidth, setCanvasPanelWidth] = useState(600);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);
  const [hyphaCoreWindows, setHyphaCoreWindows] = useState<HyphaCoreWindow[]>([]);
  const [activeCanvasTab, setActiveCanvasTab] = useState<string | null>(null);

  // Initialize the cell manager
  const cellManager = useRef<CellManager | null>(null);

  // Simplified sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('agent');

  if (!cellManager.current) {
    cellManager.current = new CellManager(
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
  } else {
    // Update the references when they change
    cellManager.current.cells = cells;
    cellManager.current.activeCellId = activeCellId;
    cellManager.current.executionCounter = executionCounter;
    cellManager.current.notebookMetadata = notebookMetadata;
    cellManager.current.executeCodeFn = executeCode;
  }

  // Use the notebook commands hook
  const { handleCommand } = useNotebookCommands({
    cellManager: cellManager.current,
    hasInitialized
  });

  // Function to get conversation history up to a specific cell
  const getConversationHistory = useCallback((upToCellId?: string): ChatMessage[] => {
    let relevantCells = cells;
    if (upToCellId) {
      const cellIndex = cells.findIndex(cell => cell.id === upToCellId);
      if (cellIndex !== -1) {
        relevantCells = cells.slice(0, cellIndex + 1);
      }
    }
    return cellManager.current?.convertCellsToHistory(relevantCells).map(msg => ({
      ...msg,
      role: msg.role as any
    })) || [];
  }, [cells]);

  // Handle executing code
  const handleExecuteCode = useCallback(async (completionId: string, code: string, cellId?: string): Promise<string> => {
    let actualCellId = cellId;
    try {
      setIsExecutingCode(true);

      if (actualCellId) {
        const existingCell = cellManager.current?.findCell(c => c.id === actualCellId);
        if (!existingCell) {
          console.error('[DEBUG] Cell not found:', actualCellId);
          return `[Cell Id: ${actualCellId}]\n Runtime Error: cell not found`;
        }
        cellManager.current?.updateCellContent(actualCellId, code);
        console.log('[DEBUG] Updated code cell:', actualCellId);
      }
      else {
        actualCellId = cellManager.current?.addCell(
          'code',
          code,
          'assistant',
          cellManager.current?.getCurrentAgentCell() || undefined,
          lastUserCellRef.current || undefined,
          undefined,
          completionId
        ) || '';
        console.log('[DEBUG] Added code cell:', actualCellId, 'with parent:', lastUserCellRef.current, 'and ID:', completionId);
        cellManager.current?.setActiveCell(actualCellId);
        cellManager.current?.setCurrentAgentCell(actualCellId);
      }
      // wait for the next tick
      await new Promise(resolve => setTimeout(resolve, 0));
      return await cellManager.current?.executeCell(actualCellId, true) || '';
    } catch (error) {
      console.error("[DEBUG] Fatal error in handleExecuteCode:", error);
      return `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    }
    finally {
      if (actualCellId) {
        cellManager.current?.collapseCodeCell(actualCellId);
      }
      setIsExecutingCode(false);
    }
  }, [executeCode, lastUserCellRef]);

  // Use the chat completion hook
  const {
    isProcessingAgentResponse,
    activeAbortController,
    handleSendMessage: handleSendChatMessage,
    handleRegenerateClick,
    handleStopChatCompletion,
    setInitializationError: setChatInitializationError
  } = useChatCompletion({
    cellManager: cellManager.current,
    executeCode: handleExecuteCode,
    agentSettings,
    getConversationHistory,
    isReady,
    setCells
  });

  // Handle sending a message with command checking
  const handleSendMessage = useCallback((message: string) => {
    if (!isReady) {
      setInitializationError("AI assistant is not ready. Please wait.");
      return;
    }

    // If the message starts with / or #, it's a command
    if (message.startsWith('/') || message.startsWith('#')) {
      handleCommand(message);
      return;
    }

    // Otherwise, send to chat
    handleSendChatMessage(message);
  }, [isReady, handleCommand, handleSendChatMessage, setInitializationError]);

  // Save notebook to localStorage
  const saveNotebook = useCallback(async () => {
    if (cellManager.current) {
      try {
        await cellManager.current.saveToLocalStorage();
        showToast('Notebook saved successfully', 'success');
      } catch (error) {
        console.error('Error saving notebook:', error);
        showToast('Failed to save notebook', 'error');
      }
    }
  }, []);

  // Handle loading notebook from file input
  const loadNotebook = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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
          title: notebookData.metadata?.title || 'Untitled Chat',
          modified: new Date().toISOString()
        };

        setNotebookMetadata(metadata);

        // Filter out any thinking cells
        const filteredCells = notebookData.cells.filter(cell => cell.type !== 'thinking');

        // Find the highest execution count to continue from
        let maxExecutionCount = 0;
        filteredCells.forEach(cell => {
          if (cell.executionCount && cell.executionCount > maxExecutionCount) {
            maxExecutionCount = cell.executionCount;
          }
        });

        setExecutionCounter(maxExecutionCount + 1);

        // Clear existing cells using cellManager
        cellManager.current?.clearAllCells();

        // Create a mapping of old cell IDs to new cell IDs
        const idMapping: { [oldId: string]: string } = {};

        // Add a small delay to ensure cells are cleared before adding new ones
        setTimeout(() => {
          // First pass: Create all cells and build ID mapping
          filteredCells.forEach((cell) => {
            const oldId = cell.id;
            const newCellId = cellManager.current?.addCell(
              cell.type,
              cell.content || '',
              cell.role || (cell.metadata?.role as CellRole | undefined)
            ) || '';
            idMapping[oldId] = newCellId;
          });

          // Second pass: Update parent references and other cell properties
          filteredCells.forEach((cell, index) => {
            const newCellId = idMapping[cell.id];
            if (!newCellId) return;

            // Update parent reference if it exists
            if (cell.metadata?.parent) {
              const newParentId = idMapping[cell.metadata.parent];
              if (newParentId) {
                setCells(prev => prev.map(c => {
                  if (c.id === newCellId) {
                    return {
                      ...c,
                      metadata: {
                        ...c.metadata,
                        parent: newParentId
                      }
                    };
                  }
                  return c;
                }));
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

              cellManager.current?.updateCellExecutionState(newCellId, executionState, outputs);
            }

            // Set code visibility based on metadata and cell role
            if (cell.role === 'system') {
              // Always hide system cells by default when loading
              cellManager.current?.toggleCodeVisibility(newCellId);
              cellManager.current?.hideCellOutput(newCellId);
            } else if (cell.type === 'code' && cell.metadata?.isCodeVisible === false) {
              cellManager.current?.toggleCodeVisibility(newCellId);
            }

            // If it's the last cell, make it active
            if (index === filteredCells.length - 1) {
              cellManager.current?.setActiveCell(newCellId);
            }
          });

          // Save the newly loaded notebook to localStorage
          saveNotebook();
        }, 100);
      } catch (error) {
        console.error('Error loading notebook:', error);
        showToast('Failed to load notebook file', 'error');
      }
    };
    reader.readAsText(file);
  }, [saveNotebook]);

  // Handle downloading notebook
  const handleDownloadNotebook = useCallback(() => {
    if (cellManager.current) {
      const notebookData: NotebookData = {
        metadata: {
          ...notebookMetadata,
          modified: new Date().toISOString()
        },
        cells: cellManager.current.getCurrentCellsContent()
      };
      downloadNotebook(notebookData);
    }
  }, [notebookMetadata]);

  // Add window callback for canvas panel
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

  // Handle closing tabs in canvas panel
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

  // Setup notebook service
  useEffect(() => {
    if (server && isLoggedIn && !hyphaCoreApi && isReady) {
      console.log("HyphaCore is ready");
      const setupService = async () => {
        try {
          const api = await setupNotebookService({
            onAddWindow: addWindowCallback,
            server,
            executeCode,
            agentSettings
          });
          setHyphaCoreApi(api);
        } catch (error) {
          console.error("Failed to setup notebook service:", error);
        }
      };
      setupService();
    }
  }, [server, isLoggedIn, addWindowCallback, isReady, executeCode, agentSettings, hyphaCoreApi]);

  // Load saved state on mount
  useEffect(() => {
    const loadInitialState = async () => {
      if (!hasInitialized.current) {
        try {
          const savedState = await cellManager.current?.loadFromLocalStorage();
          if (savedState) {
            console.log('Restored notebook state from localStorage');
            // Filter out thinking cells from the restored state
            const nonThinkingCells = savedState.cells.filter((cell: NotebookCell) => cell.type !== 'thinking');
            
            // Process system cells visibility first
            const systemCells = nonThinkingCells.filter((cell: NotebookCell) => cell.role === 'system');
            if (systemCells.length > 0) {
              // Update system cells visibility in the cells array before setting state
              const updatedCells = nonThinkingCells.map(cell => {
                if (cell.role === 'system') {
                  return {
                    ...cell,
                    metadata: {
                      ...cell.metadata,
                      isCodeVisible: false,
                      isOutputVisible: false
                    }
                  };
                }
                return cell;
              });
              // Set all state at once
              setCells(updatedCells);
              setNotebookMetadata(savedState.metadata);
              
              // Find the highest execution count
              const maxExecutionCount = Math.max(...updatedCells.map(cell => cell.executionCount || 0));
              setExecutionCounter(maxExecutionCount + 1);
            } else {
              // No system cells, just set the state normally
              setCells(nonThinkingCells);
              setNotebookMetadata(savedState.metadata);
              const maxExecutionCount = Math.max(...nonThinkingCells.map(cell => cell.executionCount || 0));
              setExecutionCounter(maxExecutionCount + 1);
            }
          } else {
            // No saved state, add welcome cells
            console.log('No saved state found, adding welcome cells');
            
            // Add system cell (hidden by default)
            const systemCellId = cellManager.current?.addCell(
              'code',
              `# Startup script\n\n# Use this cell to include any startup code you want to run when the notebook is opened.\n# Use print statements to output system prompts for the AI assistant.`,
              'system'
            );
            
            // Add welcome message
            const welcomeCellId = cellManager.current?.addCell(
              'markdown',
              `# 🚀 Welcome to the Interactive Notebook\n\nThis notebook combines the power of Jupyter notebooks with AI assistance.\n\n* Type your question or request in the chat input below\n* Add code cells with \`/code\` command\n* Add markdown cells with \`/markdown\` command\n* Run cells with the run button or Ctrl+Enter`,
              'assistant'
            );
            
            // Add empty code cell
            const codeCellId = cellManager.current?.addCell('code', '', 'assistant');
            
            if (systemCellId) {
              setCells(prev => prev.map(cell => {
                if (cell.id === systemCellId) {
                  return {
                    ...cell,
                    metadata: {
                      ...cell.metadata,
                      isCodeVisible: false,
                      isOutputVisible: false
                    }
                  };
                }
                return cell;
              }));
            }
          }
        } catch (error) {
          console.error('Error loading initial state:', error);
          // Add fallback welcome cells
          cellManager.current?.addCell(
            'markdown',
            `# 🚀 Welcome to the Interactive Notebook\n\nThis notebook combines the power of Jupyter notebooks with AI assistance.\n\n* Type your question or request in the chat input below\n* Add code cells with \`/code\` command\n* Add markdown cells with \`/markdown\` command\n* Run cells with the run button or Ctrl+Enter`,
            'assistant'
          );
          cellManager.current?.addCell('code', '', 'assistant');
        }
        
        hasInitialized.current = true;
      }
    };

    loadInitialState();
  }, []); // Empty dependency array since we only want this to run once

  // Auto-save notebook when cells or metadata change
  useEffect(() => {
    // Skip auto-save during initial load
    if (!hasInitialized.current) return;

    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer with longer delay
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        if (cellManager.current && cells.length > 0) {
          await cellManager.current.saveToLocalStorage();
          console.log('[DEBUG] Saved notebook state:', { cellCount: cells.length });
        }
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
  }, [cells, notebookMetadata]);

  // Clean up thinking cells on mount
  useEffect(() => {
    // Remove all thinking cells
    if (cells.length > 0) {
      const nonThinkingCells = cells.filter(cell => cell.type !== 'thinking');
      if (nonThinkingCells.length !== cells.length) {
        console.log('Removing thinking cells');
        setCells(nonThinkingCells);
      }
    }
  }, []); // This should run only once on mount

  // Set AI ready status
  useEffect(() => {
    setInitializationError(null);
    setIsAIReady(true);
  }, [server]);

  // Handle markdown cell rendering
  const handleMarkdownRender = useCallback((id: string) => {
    const cell = cellManager.current?.findCell(c => c.id === id);
    if (cell && cell.type === 'markdown') {
      cellManager.current?.toggleCellEditing(id, false);
    }
  }, [cellManager]);

  // Restart kernel and clear outputs
  const handleRestartKernel = async () => {
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to restart the kernel? This will clear all outputs and reset the execution state.')) {
      return;
    }
    // clear running state for all cells
    cellManager.current?.clearAllOutputs();
    setExecutionCounter(1);
    await restartKernel();
  };

  // Add keyboard event listener
  useEffect(() => {
    const handleKeyboardEvent = (e: KeyboardEvent) => {
      // Save shortcut (Ctrl/Cmd + S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl/Cmd + Shift + S for download
          handleDownloadNotebook();
        } else {
          // Ctrl/Cmd + S for save
          saveNotebook();
        }
      }

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
            cellManager.current?.setActiveCell(nextCell.id);
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
        const cell = cellManager.current?.findCell(c => c.id === cellId);
        if (!cell) return;

        if (cell.type === 'code') {
          cellManager.current?.executeCell(cellId, true); // Execute and move focus
        } else if (cell.type === 'markdown') {
          handleMarkdownRender(cellId);
          cellManager.current?.moveToNextCell(cellId);
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
            cellManager.current?.executeCell(cellId, false);
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
            const newCellId = cellManager.current?.addCell('code', '', 'user', cellId);
            cellManager.current?.setActiveCell(newCellId || '');
            const editor = editorRefs.current[newCellId || '']?.current;
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
        cellManager.current?.runAllCells();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyboardEvent);
    return () => window.removeEventListener('keydown', handleKeyboardEvent);
  }, [saveNotebook, handleDownloadNotebook, handleMarkdownRender, cells, activeCellId]);

  // Run system cells on startup
  useEffect(() => {
    const executeSystemCell = async () => {
      if (!isReady || !hasInitialized.current || systemCellsExecutedRef.current) return;

      const systemCells = cells.filter(cell => cell.role === 'system' && cell.type === 'code');
      if (systemCells.length === 0) return;

      const systemCellId = systemCells[0].id;
      console.log('Executing system cell:', systemCellId);
      
      // Mark as executed before starting to prevent re-execution
      systemCellsExecutedRef.current = true;

      try {
        await cellManager.current?.executeCell(systemCellId, false);
        // Immediately hide the cell after execution
        cellManager.current?.hideCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
      } catch (error) {
        console.error('Error executing system cell:', error);
        cellManager.current?.showCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
      }
    };

    executeSystemCell();
  }, [isReady]); // Only depend on isReady to prevent re-execution

  // Get editor ref helper
  const getEditorRef = useCallback((id: string) => {
    if (!editorRefs.current[id]) {
      editorRefs.current[id] = React.createRef();
    }
    return editorRefs.current[id];
  }, []);

  // Clean up editor refs when cells are removed
  useEffect(() => {
    const currentIds = new Set(cells.map(cell => cell.id));
    Object.keys(editorRefs.current).forEach(id => {
      if (!currentIds.has(id)) {
        delete editorRefs.current[id];
      }
    });
  }, [cells]);

  // Handler functions for NotebookContent component
  const handleActiveCellChange = (id: string) => cellManager.current?.setActiveCell(id);
  const handleExecuteCell = (id: string) => cellManager.current?.executeCell(id);
  const handleUpdateCellContent = (id: string, content: string) => cellManager.current?.updateCellContent(id, content);
  const handleToggleCellEditing = (id: string, isEditing: boolean) => cellManager.current?.toggleCellEditing(id, isEditing);
  const handleToggleCodeVisibility = (id: string) => cellManager.current?.toggleCodeVisibility(id);
  const handleToggleOutputVisibility = (id: string) => cellManager.current?.toggleOutputVisibility(id);
  const handleCellTypeChange = (id: string, cellType: CellType) => {
    cellManager.current?.changeCellType(id, cellType);
  };
  
  // Enhanced updateCellRole to automatically show system prompts when a cell is changed to system role
  const handleUpdateCellRole = (id: string, role: CellRole) => {
    cellManager.current?.updateCellRole(id, role);
  };
  
  const handleDeleteCell = (id: string) => cellManager.current?.deleteCell(id);
  const handleDeleteCellWithChildren = (id: string) => cellManager.current?.deleteCellWithChildren(id);
  const handleToggleCellCommitStatus = (id: string) => cellManager.current?.toggleCellCommitStatus(id);

  // Handler for running all cells
  const handleRunAllCells = () => cellManager.current?.runAllCells();

  // Handler for clearing all outputs
  const handleClearAllOutputs = () => cellManager.current?.clearAllOutputs();

  // Handler for adding a cell
  const handleAddCodeCell = () => {
    const afterId = activeCellId || undefined;
    cellManager.current?.addCell('code', '', 'user', afterId);
  };
  
  const handleAddMarkdownCell = () => {
    const afterId = activeCellId || undefined;
    cellManager.current?.addCell('markdown', '', 'user', afterId);
  };


  // Handler for updating notebook metadata
  const handleMetadataChange = (metadata: NotebookMetadata) => {
    setNotebookMetadata(metadata);
  };

  // Add wrapper function for settings change
  const handleAgentSettingsChange = useCallback((settings: Partial<AgentSettings>) => {
    setAgentSettings(prev => ({
      ...prev,
      ...settings
    }));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main notebook content */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <div className="flex flex-col h-full bg-gray-50">
          {/* Header - Full width */}
          <NotebookHeader
            metadata={notebookMetadata}
            onMetadataChange={handleMetadataChange}
            onSave={saveNotebook}
            onDownload={handleDownloadNotebook}
            onLoad={loadNotebook}
            onRunAll={handleRunAllCells}
            onClearOutputs={handleClearAllOutputs}
            onRestartKernel={handleRestartKernel}
            onAddCodeCell={handleAddCodeCell}
            onAddMarkdownCell={handleAddMarkdownCell}
            onShowKeyboardShortcuts={() => setIsShortcutsDialogOpen(true)}
            onToggleCanvasPanel={() => setShowCanvasPanel(!showCanvasPanel)}
            showCanvasPanel={showCanvasPanel}
            isProcessing={isProcessingAgentResponse}
            isReady={isReady}
          />

          {/* Main content area with notebook and canvas panel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left side: Sidebar + Notebook Content + Chat Input */}
            <div className="flex-1 min-w-0 flex relative">
              {/* Sidebar */}
              <Sidebar
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                activeTab={activeSidebarTab}
                onTabChange={setActiveSidebarTab}
              />

              {/* Notebook Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div className="max-w-5xl mx-auto px-0 sm:px-4 py-1 pb-48">
                    <NotebookContent
                      cells={cells}
                      activeCellId={activeCellId}
                      onActiveCellChange={handleActiveCellChange}
                      onExecuteCell={handleExecuteCell}
                      onUpdateCellContent={handleUpdateCellContent}
                      onToggleCellEditing={handleToggleCellEditing}
                      onToggleCodeVisibility={handleToggleCodeVisibility}
                      onToggleOutputVisibility={handleToggleOutputVisibility}
                      onChangeCellType={handleCellTypeChange}
                      onUpdateCellRole={handleUpdateCellRole}
                      onDeleteCell={handleDeleteCell}
                      onDeleteCellWithChildren={handleDeleteCellWithChildren}
                      onToggleCellCommitStatus={handleToggleCellCommitStatus}
                      onRegenerateClick={handleRegenerateClick}
                      onStopChatCompletion={handleStopChatCompletion}
                      getEditorRef={getEditorRef}
                      isReady={isReady}
                      activeAbortController={activeAbortController}
                    />
                  </div>
                </div>

                {/* Footer with chat input */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm pt-1 px-4 pb-4 shadow-md">
                  <NotebookFooter
                    onSendMessage={handleSendMessage}
                    onStopChatCompletion={handleStopChatCompletion}
                    isProcessing={isProcessingAgentResponse}
                    isThebeReady={isReady}
                    isAIReady={isAIReady}
                    initializationError={initializationError}
                    agentSettings={agentSettings}
                    onSettingsChange={handleAgentSettingsChange}
                  />
                </div>
              </div>
            </div>

            {/* Right side: Canvas Panel */}
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

const AgentLab: React.FC = () => {
  return (
    <ThebeProvider>
      <ToolProvider>
        <NotebookPage />
      </ToolProvider>
    </ThebeProvider>
  );
};

export default AgentLab; 