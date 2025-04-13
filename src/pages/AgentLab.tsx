import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { ThebeProvider, useThebe } from '../components/chat/ThebeProvider';
import '../styles/ansi.css';
import '../styles/notebook.css';
import { useHyphaStore } from '../store/hyphaStore';
import { CellManager, StorageLocation, SavedState } from './CellManager';
// Add styles for the active cell
import '../styles/notebook.css';
import { AgentSettings } from '../utils/chatCompletion';
import { loadSavedAgentSettings } from '../components/chat/AgentSettingsPanel';
import { CanvasPanel } from '../components/notebook/CanvasPanel';
import { setupNotebookService, HyphaCoreWindow } from '../components/services/hyphaCoreServices';
import { ChatMessage } from '../utils/chatCompletion';

// Import components
import NotebookHeader from '../components/notebook/NotebookHeader';
import NotebookContent from '../components/notebook/NotebookContent';
import NotebookFooter from '../components/notebook/NotebookFooter';
import KeyboardShortcutsDialog from '../components/notebook/KeyboardShortcutsDialog';

// Import utilities and types
import { NotebookCell, NotebookData, NotebookMetadata, CellType, CellRole, OutputItem } from '../types/notebook';
import { showToast, downloadNotebook, dismissToast } from '../utils/notebookUtils';
import { v4 as uuidv4 } from 'uuid';

// Import hooks
import { useChatCompletion } from '../hooks/useChatCompletion';
import { useNotebookCommands } from '../hooks/useNotebookCommands';

// Add imports for Sidebar components
import Sidebar from '../components/notebook/Sidebar';

// Import types from ProjectsProvider and use BaseProject alias
import type { Project as BaseProject, ProjectFile } from '../providers/ProjectsProvider';
import { ProjectsProvider, useProjects } from '../providers/ProjectsProvider';

import localforage from 'localforage';

// Add CellRole enum values
const CELL_ROLES = {
  THINKING: 'thinking' as CellRole,
  SYSTEM: 'system' as CellRole,
  USER: 'user' as CellRole,
  ASSISTANT: 'assistant' as CellRole
};

const defaultNotebookMetadata: NotebookMetadata = {
  modified: new Date().toISOString(),
  kernelspec: {
    name: 'python3',
    display_name: 'Python 3'
  },
  language_info: {
    name: 'python',
    version: '3.9'
  },
  title: 'Untitled Chat',
  created: new Date().toISOString()
};

const defaultNotebookData: NotebookData = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: defaultNotebookMetadata,
  cells: []
};

// Define additional types
interface ProjectManifest {
  name: string;
  description: string;
  version: string;
  type: string;
  created_at: string;
  filePath?: string;
}

// Extend the base Project type
interface Project extends BaseProject {
  manifest: ProjectManifest;
}

const NotebookPage: React.FC = () => {
  const navigate = useNavigate();
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [executionCounter, setExecutionCounter] = useState(1);
  const { isReady, executeCode, restartKernel } = useThebe();
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const hasInitialized = useRef(false);
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
  
  // Call useProjects at the top level and get isLoading
  const projectsProvider = useProjects();
  const {
    selectedProject,
    getFileContent,
    uploadFile,
    getInBrowserProject,
    saveInBrowserFile,
    getInBrowserFileContent,
    isLoading: isProjectsLoading, // Destructure and rename isLoading
  } = projectsProvider;

  // Store the opened file information
  const [openedFile, setOpenedFile] = useState<ProjectFile | null>(null);

  const [canvasPanelWidth, setCanvasPanelWidth] = useState(600);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);
  const [hyphaCoreWindows, setHyphaCoreWindows] = useState<HyphaCoreWindow[]>([]);
  const [activeCanvasTab, setActiveCanvasTab] = useState<string | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

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
      executeCode,
      // REMOVE projectsProvider argument
      // projectsProvider 
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
    handleSendChatMessage,
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

  // Debounced save function (for in-browser/default storage)
  const debouncedSave = useCallback(
    debounce(async (location: StorageLocation, state: SavedState) => {
      // Check if saving to in-browser
      if (!location.projectId && location.filePath) {
        try {
          console.log('[AgentLab Debounced Save] Saving to in-browser:', location.filePath);
          // Prepare data (already done when calling debouncedSave)
          const notebookData = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: state.metadata,
            cells: state.cells
          };
          await saveInBrowserFile(location.filePath, notebookData);
          console.log('[AgentLab Debounced Save] Saved successfully.');
        } catch (error) {
          console.error('Error auto-saving in-browser notebook:', error);
        }
      } else {
        console.log('[AgentLab Debounced Save] Skipping - not an in-browser save location.', location);
      }
    }, 2000), // Debounce time (e.g., 2 seconds)
    [saveInBrowserFile] // Dependency is the provider function
  );

  // Move loadFileContent definition higher up
  const loadFileContent = async (file: ProjectFile) => {
    const loadingToastId = 'loading-notebook'; // Unique ID for the loading toast

    // Check if projects provider is ready BEFORE trying to load a project file
    if (selectedProject?.id && selectedProject.id !== 'in-browser' && isProjectsLoading) {
      console.warn('[AgentLab] Load file cancelled: Projects provider is still loading.');
      showToast('Projects are still loading, please try again shortly.', 'warning');
      return; // Prevent loading if the provider isn't ready for project files
    }

    if (!selectedProject) {
      console.error('[AgentLab] Cannot load file: No project selected.');
      showToast('Error: No project selected.', 'error');
      return;
    }

    console.log(`[AgentLab] Loading content for file: ${file.path} in project: ${selectedProject.id}`);
    showToast('Loading notebook...', 'loading', { id: loadingToastId });

    try {
      let storageLocation: StorageLocation;
      if (selectedProject.id === 'in-browser') {
        storageLocation = { filePath: file.path };
      } else {
        storageLocation = { projectId: selectedProject.id, filePath: file.path };
      }

      const rawContent = await getFileContent(storageLocation.projectId || 'in-browser', storageLocation.filePath);
      const notebookData: NotebookData = JSON.parse(rawContent);

      if (notebookData) {
        console.log('[AgentLab] Successfully parsed loaded state:', { cellCount: notebookData.cells?.length });
        setNotebookMetadata({
          ...defaultNotebookMetadata,
          ...(notebookData.metadata || {}),
          title: notebookData.metadata?.title || file.path.split('/').pop() || 'Untitled Chat',
          filePath: storageLocation.filePath,
          projectId: storageLocation.projectId
        });
        setCells(notebookData.cells || []);

        let maxExecutionCount = 0;
        (notebookData.cells || []).forEach((cell: NotebookCell) => {
          const count = cell.executionCount;
          if (typeof count === 'number' && isFinite(count) && count > maxExecutionCount) {
            maxExecutionCount = count;
          }
        });
        setExecutionCounter(maxExecutionCount + 1);

        showToast('Notebook loaded successfully', 'success');
      } else {
        console.warn('[AgentLab] No valid notebook data found after parsing:', storageLocation);
        throw new Error('Invalid notebook file format');
      }
    } catch (error) {
      console.error('[AgentLab] Error loading file content:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to load notebook: ${errorMessage}`, 'error');
    } finally {
      dismissToast(loadingToastId);
    }
  };

  // Save notebook based on current context (openedFile, selectedProject)
  const saveNotebook = useCallback(async () => {
    if (!cellManager.current) {
      console.warn('[AgentLab Save] Cancelled: CellManager not available.');
      return;
    }
    if (isProjectsLoading) {
      console.warn('[AgentLab Save] Cancelled: Projects provider is still loading.');
      showToast('Projects are still loading, please wait before saving.', 'warning');
      return;
    }

    let storageLocation: StorageLocation | null = null;
    if (openedFile?.path) {
      if (selectedProject?.id === 'in-browser') {
        storageLocation = { filePath: openedFile.path };
      } else if (selectedProject?.id) {
        storageLocation = { projectId: selectedProject.id, filePath: openedFile.path };
      }
    } else {
      // Handle saving a new/unsaved notebook (currently assumes in-browser)
      storageLocation = { filePath: notebookMetadata.filePath || `notebook-${uuidv4()}.ipynb` }; // Generate a default name if needed
      console.warn('[AgentLab Save] Saving potentially new notebook to in-browser storage:', storageLocation.filePath);
       // Update metadata immediately if we generated a name
       if (!notebookMetadata.filePath) {
         setNotebookMetadata(prev => ({...prev, filePath: storageLocation?.filePath}));
       }
    }

    if (!storageLocation) {
      console.error('[AgentLab Save] Failed: Could not determine storage location.');
      showToast('Cannot determine where to save.', 'error');
      return;
    }

    console.log('[AgentLab Save] Attempting save to:', storageLocation);
    showToast('Saving...', 'loading', { id: 'saving-notebook' });

    try {
      const metadataToSave: NotebookMetadata = {
        ...notebookMetadata,
        modified: new Date().toISOString(),
        projectId: storageLocation.projectId,
        filePath: storageLocation.filePath
      };
      // Update metadata state immediately for consistency
      setNotebookMetadata(metadataToSave);

      const notebookData = {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: metadataToSave,
        cells: cellManager.current.getCurrentCellsContent()
      };

      if (storageLocation.projectId) {
        // Save to remote project
        const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
        const file = new File([blob], storageLocation.filePath.split('/').pop() || 'notebook.ipynb', { type: 'application/json' });
        await uploadFile(storageLocation.projectId, file);
      } else {
        // Save to in-browser storage
        await saveInBrowserFile(storageLocation.filePath, notebookData);
      }

      // Update openedFile state if we just saved a new file
      if (!openedFile && storageLocation.filePath) {
        setOpenedFile({ name: storageLocation.filePath.split('/').pop() || storageLocation.filePath, path: storageLocation.filePath, type: 'file' });
      }

      showToast('Notebook saved successfully', 'success', { id: 'saving-notebook' });
    } catch (error) {
      console.error('Error saving notebook:', error);
      showToast(`Failed to save notebook: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', { id: 'saving-notebook' });
    }
  }, [cellManager, selectedProject, notebookMetadata, openedFile, isProjectsLoading, uploadFile, saveInBrowserFile]);

  // Handle loading notebook from file input (legacy/upload button)
  const loadNotebookFromFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const loadedNotebookData: NotebookData = JSON.parse(content);

        // Process and set state
        const metadata = {
          ...defaultNotebookMetadata,
          ...(loadedNotebookData.metadata || {}),
          title: loadedNotebookData.metadata?.title || file.name || 'Untitled Chat',
          modified: new Date().toISOString(),
          // Clear project/file path as this is loaded from a local file
          projectId: undefined,
          filePath: undefined
        };
        setNotebookMetadata(metadata);

        const cellsToLoad = loadedNotebookData.cells?.filter((cell: NotebookCell) => cell.type !== 'thinking') || [];
        setCells(cellsToLoad);

        // Calculate execution count
        let maxExecutionCount = 0;
        cellsToLoad.forEach((cell: NotebookCell) => {
          const count = cell.executionCount;
          if (typeof count === 'number' && isFinite(count) && count > maxExecutionCount) {
            maxExecutionCount = count;
          }
        });
        setExecutionCounter(maxExecutionCount + 1);

        setOpenedFile({ name: file.name, path: file.name, type: 'file', content: content }); // Treat as an 'in-browser' file for now
        showToast('Notebook loaded from file', 'success');
        // Optionally, trigger an immediate save to in-browser storage
        // saveNotebook(); 
      } catch (error) {
        console.error('Error loading notebook from file:', error);
        showToast('Failed to load notebook file', 'error');
      }
    };
    reader.readAsText(file);
  }, [saveNotebook]); // Include saveNotebook if you uncomment the auto-save

  // --- Restore Handler Functions --- 

  const filterThinkingCells = (cell: NotebookCell) => {
    return cell.metadata?.role !== CELL_ROLES.THINKING;
  };

  const handleDownloadNotebook = () => {
    if (!cellManager.current) return;
    const visibleCells = cellManager.current.getCurrentCellsContent().filter(filterThinkingCells);
    const notebookData: NotebookData = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        ...notebookMetadata,
        filePath: notebookMetadata.filePath || ''
      },
      cells: visibleCells
    };
    downloadNotebook(notebookData);
  };

  const handleRunAllCells = () => cellManager.current?.runAllCells();
  const handleClearAllOutputs = () => cellManager.current?.clearAllOutputs();
  const handleRestartKernel = async () => {
    if (!window.confirm('Are you sure you want to restart the kernel? This will clear all outputs and reset the execution state.')) return;
    cellManager.current?.clearAllOutputs();
    setExecutionCounter(1);
    await restartKernel();
  };
  const handleAddCodeCell = () => {
    const afterId = activeCellId || undefined;
    cellManager.current?.addCell('code', '', 'user', afterId);
  };
  const handleAddMarkdownCell = () => {
    const afterId = activeCellId || undefined;
    cellManager.current?.addCell('markdown', '', 'user', afterId);
  };
  // --- End Restore Handler Functions --- 

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
            agentSettings,
            abortSignal: activeAbortController?.signal
          });
          setHyphaCoreApi(api);
        } catch (error) {
          console.error("Failed to setup notebook service:", error);
        }
      };
      setupService();
    }
  }, [server, isLoggedIn, addWindowCallback, isReady, executeCode, agentSettings, hyphaCoreApi, activeAbortController]);

  // Load initial state on mount (handle in-browser/default storage)
  useEffect(() => {
    const loadInitialState = async () => {
      if (!hasInitialized.current && !isProjectsLoading) { // Also wait for projects to load
        try {
          // Check if a specific file was opened (e.g., from URL or previous state)
          let locationToLoad: StorageLocation | null = null;
          if (openedFile) {
              if (selectedProject?.id === 'in-browser') {
                  locationToLoad = { filePath: openedFile.path };
              } else if (selectedProject?.id) {
                  locationToLoad = { projectId: selectedProject.id, filePath: openedFile.path };
              }
          } else {
              // Fallback to default in-browser location if no file is open
              locationToLoad = { filePath: 'default' }; 
          }

          if (locationToLoad) {
            console.log('[AgentLab Initial Load] Attempting to load from:', locationToLoad);
            // Call getFileContent with correct arguments
            const projectIdArg = locationToLoad.projectId || 'in-browser'; 
            const filePathArg = locationToLoad.filePath;
            // Ensure we don't call if filePath is missing (e.g. 'default' scenario needs handling)
            if (filePathArg && filePathArg !== 'default') {
                await getFileContent(projectIdArg, filePathArg); 
            } else {
                console.log('[AgentLab Initial Load] Skipping load for default/missing filePath');
                // Handle default state loading here if needed, or ensure it's handled in the 'else' block below
            }
          } else {
             console.log('[AgentLab Initial Load] No specific file/project context, loading default welcome state.');
             // Initialize with welcome cells if no specific location
             setCells([]); // Clear any potentially stale cells
             setNotebookMetadata(defaultNotebookMetadata);
             const systemCellId = cellManager.current?.addCell('code', `# Startup script\n...`, 'system'); // Shortened for brevity
             cellManager.current?.addCell('markdown', `# Welcome...`, 'assistant');
             cellManager.current?.addCell('code', '', 'assistant');
             // Hide system cell immediately
             if (systemCellId) {
               setCells(prev => prev.map(cell => cell.id === systemCellId ? { ...cell, metadata: { ...cell.metadata, isCodeVisible: false, isOutputVisible: false } } : cell));
             }
          }
        } catch (error) {
          console.error('[AgentLab Initial Load] Error loading initial state:', error);
          // Fallback to welcome cells on any error during initial load
           setCells([]);
           setNotebookMetadata(defaultNotebookMetadata);
           cellManager.current?.addCell('markdown', `# Welcome... (Error Loading)`, 'assistant');
           cellManager.current?.addCell('code', '', 'assistant');
        }
        hasInitialized.current = true;
      }
    };

    loadInitialState();
  // Depend on projects loading status and selected project changes
  }, [isProjectsLoading, selectedProject, openedFile, getFileContent]); // Added getFileContent dependency

  // Effect for auto-saving to a Project (Cloud/Server storage)
  useEffect(() => {
    const autoSaveToProject = async () => {
      if (isProjectsLoading || !hasInitialized.current || !cellManager.current || !notebookMetadata.projectId || !notebookMetadata.filePath || notebookMetadata.projectId === 'in-browser') {
        // console.log('[AgentLab] Skipping auto-save to project: Not ready, no project context, or in-browser.');
        return;
      }

      console.log('[AgentLab AutoSave Project] Starting auto-save to project:', notebookMetadata.filePath);
      try {
        const notebookData = {
          nbformat: 4,
          nbformat_minor: 5,
          metadata: {
            ...notebookMetadata,
            modified: new Date().toISOString()
          },
          cells: cellManager.current.getCurrentCellsContent()
        };

        const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
        const file = new File([blob], notebookMetadata.filePath.split('/').pop() || 'notebook.ipynb', { type: 'application/json' });

        await uploadFile(notebookMetadata.projectId, file);
        // console.log('[AgentLab AutoSave Project] Auto-saved notebook to project:', notebookMetadata.filePath);
      } catch (error) {
        console.error('Error auto-saving notebook to project:', error);
      }
    };

    const timeoutId = setTimeout(autoSaveToProject, 5000); // e.g., 5 seconds debounce
    return () => clearTimeout(timeoutId);

  }, [cells, notebookMetadata, uploadFile, isProjectsLoading]); // Dependencies

    // Update autosave effect for the debounced function (primarily for in-browser/default)
    useEffect(() => {
      if (!hasInitialized.current || !cellManager.current || !openedFile?.path || selectedProject?.id !== 'in-browser') {
         // console.log('[AgentLab AutoSave InBrowser] Skipping: Not init, no file, or not in-browser');
         return;
      }

      const storageLocation: StorageLocation = { filePath: openedFile.path }; // Only for in-browser

      console.log('[AgentLab AutoSave InBrowser] Queuing debounced autosave for:', storageLocation);

      const metadataToSave: NotebookMetadata = {
        ...notebookMetadata,
        title: notebookMetadata.title || openedFile.name || 'Untitled Chat',
        modified: new Date().toISOString(),
        filePath: storageLocation.filePath,
        projectId: undefined // Explicitly undefined for in-browser
      };
      // Avoid immediate state update here, let debounced save handle it if needed?
      // Or update if necessary for UI consistency: setNotebookMetadata(prev => ({...prev, ...metadataToSave }));

      const stateToSave: SavedState = {
        cells: cellManager.current.getCurrentCellsContent(),
        metadata: metadataToSave
      };

      debouncedSave(storageLocation, stateToSave);

      return () => {
        debouncedSave.cancel();
        // console.log('[AgentLab AutoSave InBrowser] Canceled pending debounced autosave.');
      };
    }, [cells, openedFile, selectedProject, debouncedSave, notebookMetadata]); // Dependencies

  // Clean up thinking cells on mount
  useEffect(() => {
    if (cells.length > 0) {
      const nonThinkingCells = cells.filter(cell => cell.type !== 'thinking');
      if (nonThinkingCells.length !== cells.length) {
        console.log('Removing thinking cells on mount/cleanup');
        setCells(nonThinkingCells);
      }
    }
  }, []);

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

  // Add keyboard event listener
  useEffect(() => {
    const handleKeyboardEvent = (e: KeyboardEvent) => {
      // Save shortcut (Ctrl/Cmd + S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleDownloadNotebook();
        } else {
          saveNotebook(); // Use the unified save function
        }
      }
      // ... rest of keyboard shortcuts ...
    };
    window.addEventListener('keydown', handleKeyboardEvent);
    return () => window.removeEventListener('keydown', handleKeyboardEvent);
  }, [saveNotebook, handleDownloadNotebook, handleMarkdownRender, cells, activeCellId]); // Ensure saveNotebook is dependency

  // Run system cells on startup
  useEffect(() => {
    const executeSystemCell = async () => {
      if (!isReady || !hasInitialized.current || systemCellsExecutedRef.current) return;

      const systemCells = cells.filter(cell => cell.role === 'system' && cell.type === 'code');
      if (systemCells.length === 0) {
        // Mark as executed even if no system cells exist to prevent re-check
        systemCellsExecutedRef.current = true; 
        return;
      }

      const systemCellId = systemCells[0].id;
      console.log('Executing system cell:', systemCellId);
      systemCellsExecutedRef.current = true;

      try {
        await cellManager.current?.executeCell(systemCellId, false);
        cellManager.current?.hideCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
      } catch (error) {
        console.error('Error executing system cell:', error);
        cellManager.current?.showCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
      }
    };

    executeSystemCell();
  }, [isReady, cells, hasInitialized.current]); // Depend on cells and hasInitialized flag

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
  const handleExecuteCell = (id: string): Promise<string> => {
    return cellManager.current?.executeCell(id) || Promise.resolve('');
  };
  const handleUpdateCellContent = (id: string, content: string) => cellManager.current?.updateCellContent(id, content);
  const handleToggleCellEditing = (id: string, isEditing: boolean) => cellManager.current?.toggleCellEditing(id, isEditing);
  const handleToggleCodeVisibility = (id: string) => cellManager.current?.toggleCodeVisibility(id);
  const handleToggleOutputVisibility = (id: string) => cellManager.current?.toggleOutputVisibility(id);
  const handleCellTypeChange = (id: string, cellType: CellType) => {
    cellManager.current?.changeCellType(id, cellType);
  };
  const handleUpdateCellRole = (id: string, role: CellRole) => {
    cellManager.current?.updateCellRole(id, role);
  };
  const handleDeleteCell = (id: string) => cellManager.current?.deleteCell(id);
  const handleDeleteCellWithChildren = (id: string) => cellManager.current?.deleteCellWithChildren(id);
  const handleToggleCellCommitStatus = (id: string) => cellManager.current?.toggleCellCommitStatus(id);

  // Handler for updating notebook metadata (already passed setter directly)
  // const handleMetadataChange = (metadata: NotebookMetadata) => setNotebookMetadata(metadata);

  // Handler for settings change (already passed setter directly)
  // const handleAgentSettingsChange = useCallback((settings: Partial<AgentSettings>) => setAgentSettings(prev => ({ ...prev, ...settings })), []);

  // Add central loading function (already defined as loadFileContent)

  // Update handleFileSelect: Only sets the opened file for now
  const handleFileSelect = async (file: ProjectFile) => {
    console.log('[AgentLab] Selected file:', file);
  };

  // Update handleFileDoubleClick: Sets opened file and calls loadFileContent
  const handleFileDoubleClick = async (file: ProjectFile) => {
    console.log('[AgentLab] Double-clicked file:', file);
    setOpenedFile(file);
    // Call getFileContent with correct arguments
    if (selectedProject && file.path) { // Ensure we have project and path
      const projectIdArg = selectedProject.id; // Use the currently selected project ID
      const filePathArg = file.path;
      try {
          await getFileContent(projectIdArg, filePathArg); // Pass both arguments
          // Note: getFileContent now likely returns the content,
          // the loadFileContent function was rewritten to handle updating state
          // We might need to adapt this if getFileContent should directly update state now.
          // For now, assuming loadFileContent handles the update based on the 'openedFile' change.
          // Let's call the central loadFileContent instead.
          await loadFileContent(file); 
      } catch (error) {
           console.error('[AgentLab handleFileDoubleClick] Error calling getFileContent:', error);
           showToast(`Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
    } else {
      console.error('[AgentLab handleFileDoubleClick] Cannot load file: No project selected or file path missing.');
      showToast('Error: No project selected or file path missing.', 'error');
    }
  };

  // Add effect to check screen size and adjust canvas panel width
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth <= 480;
      setIsSmallScreen(isSmall);
      if (isSmall) {
        setCanvasPanelWidth(0);
      }
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Modify the canvas panel width setter to respect small screens
  const handleCanvasPanelResize = (newWidth: number) => {
    if (!isSmallScreen) {
      setCanvasPanelWidth(newWidth);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main notebook content */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <div className="flex flex-col h-full bg-gray-50">
          {/* Header - Full width */}
          <NotebookHeader
            metadata={notebookMetadata}
            onMetadataChange={setNotebookMetadata} // Pass setter directly
            onSave={saveNotebook} // Use unified save function
            onDownload={handleDownloadNotebook}
            onLoad={loadNotebookFromFile} // Use specific loader for file input
            onRunAll={handleRunAllCells}
            onClearOutputs={handleClearAllOutputs}
            onRestartKernel={handleRestartKernel}
            onAddCodeCell={handleAddCodeCell}
            onAddMarkdownCell={handleAddMarkdownCell}
            onShowKeyboardShortcuts={() => setIsShortcutsDialogOpen(true)}
            isProcessing={isProcessingAgentResponse}
            isReady={isReady && isAIReady}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
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
                onSelectFile={handleFileSelect}
                onDoubleClickFile={handleFileDoubleClick}
              />

              {/* Notebook Content Area with transition */}
              <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'ml-60' : ''}`}>
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div className="max-w-5xl mx-auto px-0 sm:px-4 py-1 pb-48">
                    <NotebookContent
                      cells={cells}
                      activeCellId={activeCellId || ''}
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
                      showCanvasPanel={showCanvasPanel}
                      onAbortExecution={handleStopChatCompletion}
                    />
                  </div>
                </div>

                {/* Footer with chat input - now part of the transition */}
                <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm pt-1 px-4 pb-4 shadow-md">
                  <NotebookFooter
                    onSendMessage={handleSendMessage}
                    onStopChatCompletion={handleStopChatCompletion}
                    isProcessing={isProcessingAgentResponse}
                    isThebeReady={isReady}
                    isAIReady={isAIReady}
                    initializationError={initializationError}
                    agentSettings={agentSettings}
                    onSettingsChange={setAgentSettings} // Pass setter directly
                  />
                </div>
              </div>
            </div>

            {/* Right side: Canvas Panel */}
            <div className="h-full relative" style={{ width: isSmallScreen ? 0 : (showCanvasPanel ? canvasPanelWidth : 36) }}>
              <CanvasPanel
                windows={hyphaCoreWindows}
                isVisible={showCanvasPanel}
                width={isSmallScreen ? 0 : canvasPanelWidth}
                activeTab={activeCanvasTab}
                onResize={handleCanvasPanelResize}
                onClose={() => setShowCanvasPanel(!showCanvasPanel)}
                onTabChange={setActiveCanvasTab}
                onTabClose={handleTabClose}
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

const AgentLab: React.FC = () => {
  return (
    <ThebeProvider>
      <ProjectsProvider>
        <NotebookPage />
      </ProjectsProvider>
    </ThebeProvider>
  );
};

export default AgentLab; 