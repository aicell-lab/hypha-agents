import React, { useState, useRef, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useNotebookInitialization } from '../hooks/useNotebookInitialization';
import { useUrlSync } from '../hooks/useUrlSync';

// Add imports for Sidebar components
import Sidebar from '../components/notebook/Sidebar';

// Import types from ProjectsProvider and use BaseProject alias
import type { Project as BaseProject, ProjectFile } from '../providers/ProjectsProvider';
import { ProjectsProvider, useProjects, IN_BROWSER_PROJECT } from '../providers/ProjectsProvider'; // Import constant

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
  created: new Date().toISOString(),
  filePath: undefined, // Ensure defaults are undefined
  projectId: undefined
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
  const hasInitialized = useRef(false); // Tracks if the initial load effect has completed
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
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selectedProject,
    setSelectedProject,
    getFileContent,
    uploadFile,
    getInBrowserProject,
    saveInBrowserFile,
    getInBrowserFileContent,
    isLoading: isProjectsLoading,
    initialLoadComplete,
  } = useProjects();

  // Get projects list for the initialization hook
  const { projects } = useProjects();

  const [canvasPanelWidth, setCanvasPanelWidth] = useState(600);
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);
  const [hyphaCoreWindows, setHyphaCoreWindows] = useState<HyphaCoreWindow[]>([]);
  const [activeCanvasTab, setActiveCanvasTab] = useState<string | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Initialize the cell manager
  const cellManager = useRef<CellManager | null>(null);

  // Simplified sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    );
  } else {
    // Update the references when they change
    cellManager.current.cells = cells;
    cellManager.current.activeCellId = activeCellId;
    cellManager.current.executionCounter = executionCounter;
    cellManager.current.notebookMetadata = notebookMetadata;
    cellManager.current.executeCodeFn = executeCode;
  }

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
      const manager = cellManager.current;
      if (!manager) {
        console.error('CellManager not initialized in handleExecuteCode');
        return "Error: CellManager not available";
      }

      if (actualCellId) {
        const existingCell = manager.findCell(c => c.id === actualCellId);
        if (!existingCell) {
          console.error('Cell not found:', actualCellId);
          return `[Cell Id: ${actualCellId}]\n Runtime Error: cell not found`;
        }
        manager.updateCellContent(actualCellId, code);
      }
      else {
        actualCellId = manager.addCell(
          'code',
          code,
          'assistant',
          manager.getCurrentAgentCell() || undefined,
          lastUserCellRef.current || undefined,
          undefined,
          completionId
        ) || '';
        manager.setActiveCell(actualCellId);
        manager.setCurrentAgentCell(actualCellId);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      return await manager.executeCell(actualCellId, true) || '';
    } catch (error) {
      console.error("Fatal error in handleExecuteCode:", error);
      return `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    }
    finally {
      if (actualCellId) {
        cellManager.current?.collapseCodeCell(actualCellId);
      }
      setIsExecutingCode(false);
    }
  }, [executeCode]);

  // --- Core Notebook Loading & Saving Functions --- (Moved Up)
  const loadNotebookContent = useCallback(async (projectId: string | undefined, filePath: string) => {
    const loadingToastId = 'loading-notebook';
    showToast('Loading notebook...', 'loading', { id: loadingToastId });

    try {
      let rawContent: string | NotebookData;
      let resolvedProjectId = projectId || IN_BROWSER_PROJECT.id;

      if (resolvedProjectId === IN_BROWSER_PROJECT.id) {
        rawContent = await getInBrowserFileContent(filePath);
      } else {
        if (isProjectsLoading || !initialLoadComplete) {
          console.warn('[AgentLab] Load file cancelled: Projects provider not ready for remote project.', resolvedProjectId);
          showToast('Projects are still loading, please try again shortly.', 'warning');
          dismissToast(loadingToastId);
          return;
        }
        rawContent = await getFileContent(resolvedProjectId, filePath);
      }

      const notebookData: NotebookData = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

      if (notebookData && typeof notebookData === 'object') {
        const loadedCells = notebookData.cells || [];

        setNotebookMetadata(prev => ({
          ...defaultNotebookMetadata,
          ...(notebookData.metadata || {}),
          title: notebookData.metadata?.title || filePath.split('/').pop() || 'Untitled Chat',
          modified: new Date().toISOString(),
          filePath: filePath,
          projectId: resolvedProjectId
        }));

        const visibleCells = loadedCells.filter(cell => cell.metadata?.role !== CELL_ROLES.THINKING);
        setCells(visibleCells);

        let maxExecutionCount = 0;
        visibleCells.forEach((cell: NotebookCell) => {
          const count = cell.executionCount;
          if (typeof count === 'number' && isFinite(count) && count > maxExecutionCount) {
            maxExecutionCount = count;
          }
        });
        setExecutionCounter(maxExecutionCount + 1);

        const userCells = visibleCells.filter(cell => cell.role === CELL_ROLES.USER);
        const assistantCells = visibleCells.filter(cell => cell.role === CELL_ROLES.ASSISTANT);
        lastUserCellRef.current = userCells[userCells.length - 1]?.id || null;
        lastAgentCellRef.current = assistantCells[assistantCells.length - 1]?.id || null;

        showToast('Notebook loaded successfully', 'success');
      } else {
        console.warn('Invalid notebook file format found after parsing:', { projectId: resolvedProjectId, filePath });
        throw new Error('Invalid notebook file format');
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to load notebook: ${errorMessage}`, 'error');
      setCells([]);
      setNotebookMetadata(defaultNotebookMetadata);
      setExecutionCounter(1);
      lastUserCellRef.current = null;
      lastAgentCellRef.current = null;
      setSelectedProject(null);
      setSearchParams({}, { replace: true });
    } finally {
      dismissToast(loadingToastId);
    }
  }, [
    isProjectsLoading,
    initialLoadComplete,
    getFileContent,
    getInBrowserFileContent,
    showToast,
    dismissToast,
    setNotebookMetadata,
    setCells,
    setExecutionCounter,
    setSelectedProject,
    setSearchParams
  ]);

  // Initialization Hook
  const hasInitializedRef = useNotebookInitialization({
    isLoggedIn,
    initialLoadComplete,
    loadNotebookContent, // Now defined above
    setSelectedProject,
    getInBrowserProject,
    setNotebookMetadata,
    setCells,
    setExecutionCounter,
    defaultNotebookMetadata,
    cellManagerRef: cellManager,
    projects,
  });

  // Notebook Commands Hook
  const { handleCommand } = useNotebookCommands({
    cellManager: cellManager.current,
    hasInitialized: hasInitializedRef
  });

  // Use the chat completion hook (Moved down, needs handleExecuteCode)
  const {
    isProcessingAgentResponse,
    activeAbortController,
    handleSendChatMessage,
    handleRegenerateClick,
    handleStopChatCompletion,
    setInitializationError: setChatInitializationError
  } = useChatCompletion({
    cellManager: cellManager.current,
    executeCode: handleExecuteCode, // Needs definition before this
    agentSettings,
    getConversationHistory,
    isReady,
    setCells
  });

  // --- Notebook Action Handlers (Moved Up) ---
  const handleRestartKernel = useCallback(async () => {
    if (!cellManager.current) return;
    setIsAIReady(false);
    showToast('Restarting kernel...', 'loading');
    try {
      await restartKernel();
      setIsAIReady(true);
      setExecutionCounter(1);
      systemCellsExecutedRef.current = false;
      showToast('Kernel restarted successfully', 'success');
    } catch (error) {
      console.error('Failed to restart kernel:', error);
      showToast('Failed to restart kernel', 'error');
      setIsAIReady(false);
    }
  }, [restartKernel, setIsAIReady, setExecutionCounter]);

  // --- Kernel State Reset Function ---
  const handleResetKernelState = useCallback(async () => {
    if (!isReady) {
      // If kernel isn't ready, perform a full restart
      console.warn('Kernel not ready, performing full restart instead of reset.');
      await handleRestartKernel();
      return;
    }

    if (!cellManager.current) return;

    showToast('Resetting kernel state...', 'loading', { id: 'resetting-kernel' });
    try {
      // Execute the reset command
      await executeCode('%reset -f');

      // Reset execution counter and system cell flag
      setExecutionCounter(1);
      systemCellsExecutedRef.current = false;

      showToast('Kernel state reset successfully', 'success', { id: 'resetting-kernel' });
      // Keep AI ready state as true, kernel is still technically ready
      // setIsAIReady(true);
    } catch (error) {
      console.error('Failed to reset kernel state:', error);
      showToast('Failed to reset kernel state', 'error', { id: 'resetting-kernel' });
      // Consider if AI should be marked as not ready on reset failure
      // setIsAIReady(false);
    }
    finally {
      dismissToast('resetting-kernel');
    }
  }, [isReady, executeCode, setExecutionCounter, showToast, handleRestartKernel]); // Add dependencies

  // Handle sending a message with command checking
  const handleCommandOrSendMessage = useCallback((message: string) => {
    if (!isReady) {
      setInitializationError("AI assistant is not ready. Please wait.");
      return;
    }
    // Check if it's a command
    if (message.startsWith('/') || message.startsWith('#')) {
      handleCommand(message); // Corrected: pass only message
      return;
    }
    // Otherwise, send it as a chat message using the hook's function
    handleSendChatMessage(message);
  }, [isReady, handleCommand, handleSendChatMessage, setInitializationError]);

  // Debounced save function (only for in-browser/default storage auto-save)
  const debouncedSave = useCallback(
    debounce(async (state: SavedState) => {
      const currentMetadata: NotebookMetadata = state.metadata; // Added explicit type
      if (currentMetadata.projectId === IN_BROWSER_PROJECT.id && currentMetadata.filePath) {
        try {
          console.log('[AgentLab Debounced Save] Saving to in-browser:', currentMetadata.filePath);
          const notebookData: NotebookData = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: currentMetadata,
            cells: state.cells
          };
          await saveInBrowserFile(currentMetadata.filePath, notebookData);
          console.log('[AgentLab Debounced Save] Saved successfully.');
        } catch (error) {
          console.error('Error auto-saving in-browser notebook:', error);
        }
      }
    }, 2000),
    [saveInBrowserFile]
  );

  // Save notebook based on current notebookMetadata
  const saveNotebook = useCallback(async () => {
    if (!cellManager.current) {
      console.warn('Save Cancelled: CellManager not available.');
      return;
    }
    if (isProjectsLoading && notebookMetadata.projectId && notebookMetadata.projectId !== IN_BROWSER_PROJECT.id) {
      console.warn('Save Cancelled: Projects provider is still loading for remote save.');
      showToast('Projects are still loading, please wait before saving.', 'warning');
      return;
    }

    let currentFilePath = notebookMetadata.filePath;
    if (!currentFilePath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      currentFilePath = `Untitled_Chat_${timestamp}.ipynb`;
      setNotebookMetadata(prev => ({
        ...prev,
        filePath: currentFilePath,
        projectId: prev.projectId || IN_BROWSER_PROJECT.id,
        modified: new Date().toISOString()
      }));
    }

    const metadataToSave: NotebookMetadata = {
      ...(cellManager.current.notebookMetadata),
      filePath: currentFilePath,
      modified: new Date().toISOString(),
    };
    const resolvedProjectId = metadataToSave.projectId || IN_BROWSER_PROJECT.id;

    if (!metadataToSave.filePath) {
        console.error('Save Failed: File path is still missing.');
        showToast('Cannot determine save file path.', 'error');
      return;
    }

    console.log('[AgentLab Save] Attempting save to:', { projectId: resolvedProjectId, filePath: metadataToSave.filePath });
    showToast('Saving...', 'loading', { id: 'saving-notebook' });

    try {
      setNotebookMetadata(metadataToSave);
      const notebookData: NotebookData = {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: metadataToSave,
        cells: cellManager.current.getCurrentCellsContent()
      };

      if (resolvedProjectId === IN_BROWSER_PROJECT.id) {
        await saveInBrowserFile(metadataToSave.filePath, notebookData);
      } else {
        console.log(`[AgentLab Save] Saving to remote project: ${resolvedProjectId}`);
        const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
        const file = new File([blob], metadataToSave.filePath.split('/').pop() || 'notebook.ipynb', { type: 'application/json' });
        await uploadFile(resolvedProjectId, file);
      }
      showToast('Notebook saved successfully', 'success', { id: 'saving-notebook' });
    } catch (error) {
      console.error('Error saving notebook:', error);
      showToast(`Failed to save notebook: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', { id: 'saving-notebook' });
    }
  }, [cellManager, notebookMetadata, isProjectsLoading, uploadFile, saveInBrowserFile, setNotebookMetadata]);

  // Handle loading notebook from file input (header upload button)
  const loadNotebookFromFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const loadedNotebookData: NotebookData = JSON.parse(content);
        const newFilePath = `uploaded_${file.name}`;
        const metadata: NotebookMetadata = {
          ...defaultNotebookMetadata,
          ...(loadedNotebookData.metadata || {}),
          title: loadedNotebookData.metadata?.title || file.name.replace('.ipynb', '') || 'Uploaded Chat',
          modified: new Date().toISOString(),
          created: new Date().toISOString(),
          projectId: IN_BROWSER_PROJECT.id,
          filePath: newFilePath
        };
        setNotebookMetadata(metadata);
        const cellsToLoad = loadedNotebookData.cells?.filter((cell: NotebookCell) => cell.metadata?.role !== CELL_ROLES.THINKING) || [];
        setCells(cellsToLoad);
        let maxExecutionCount = 0;
        cellsToLoad.forEach((cell: NotebookCell) => {
          const count = cell.executionCount;
          if (typeof count === 'number' && isFinite(count) && count > maxExecutionCount) {
            maxExecutionCount = count;
          }
        });
        setExecutionCounter(maxExecutionCount + 1);
        lastUserCellRef.current = null;
        lastAgentCellRef.current = null;
        setActiveCellId(null);
        setSelectedProject(getInBrowserProject());
        showToast(`Notebook "${file.name}" loaded as a new in-browser file`, 'success');
        const notebookToSave: NotebookData = {
          nbformat: 4,
          nbformat_minor: 5,
          metadata: metadata,
          cells: cellsToLoad
        };
        await saveInBrowserFile(newFilePath, notebookToSave)
          .then(() => console.log(`Saved uploaded file to in-browser: ${newFilePath}`))
          .catch(err => console.error(`Failed to auto-save uploaded file: ${err}`));

        // Reset kernel state after loading and saving
        // await handleRestartKernel(); // Use reset instead
        await handleResetKernelState();

      } catch (error) {
        console.error('Error loading notebook from file:', error);
        showToast('Failed to load notebook file', 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [saveInBrowserFile, setSelectedProject, getInBrowserProject, handleResetKernelState]);

  // --- Cell Action Handlers (Passed down to NotebookContent) ---
  const handleActiveCellChange = useCallback((id: string) => cellManager.current?.setActiveCell(id), []);
  const handleExecuteCell = useCallback((id: string): Promise<string> => {
    return cellManager.current?.executeCell(id, true) || Promise.resolve('Error: CellManager not ready');
  }, []);
  const handleUpdateCellContent = useCallback((id: string, content: string) => cellManager.current?.updateCellContent(id, content), []);
  const handleToggleCellEditing = useCallback((id: string, isEditing: boolean) => cellManager.current?.toggleCellEditing(id, isEditing), []);
  const handleToggleCodeVisibility = useCallback((id: string) => cellManager.current?.toggleCodeVisibility(id), []);
  const handleToggleOutputVisibility = useCallback((id: string) => cellManager.current?.toggleOutputVisibility(id), []);
  const handleCellTypeChange = useCallback((id: string, cellType: CellType) => {
    cellManager.current?.changeCellType(id, cellType);
  }, []);
  const handleUpdateCellRole = useCallback((id: string, role: CellRole) => {
    cellManager.current?.updateCellRole(id, role);
  }, []);
  const handleDeleteCell = useCallback((id: string) => cellManager.current?.deleteCell(id), []);
  const handleDeleteCellWithChildren = useCallback((id: string) => cellManager.current?.deleteCellWithChildren(id), []);
  const handleToggleCellCommitStatus = useCallback((id: string) => cellManager.current?.toggleCellCommitStatus(id), []);
  // Add definitions for missing handlers
  const handleAddCodeCell = useCallback(() => {
    cellManager.current?.addCell('code', '', 'user', activeCellId || undefined);
  }, [activeCellId]);
  const handleAddMarkdownCell = useCallback(() => {
    cellManager.current?.addCell('markdown', '', 'user', activeCellId || undefined);
  }, [activeCellId]);
  const getEditorRef = useCallback((cellId: string) => {
    if (!editorRefs.current[cellId]) {
      editorRefs.current[cellId] = React.createRef();
    }
    return editorRefs.current[cellId];
  }, []);

  // --- Canvas Panel Handlers (Placeholders) ---
  const handleCanvasPanelResize = useCallback((newWidth: number) => {
    setCanvasPanelWidth(newWidth); // Assuming this state exists
  }, []);

  const toggleCanvasPanel = useCallback(() => {
    setShowCanvasPanel(prev => !prev); // Assuming this state exists
  }, []);

  const handleTabClose = useCallback((tabId: string) => {
    setHyphaCoreWindows(prev => prev.filter(win => win.id !== tabId)); // Assuming this state exists
  }, []);

  // Callback passed to Sidebar to handle loading a selected notebook
  const handleLoadNotebook = useCallback(async (project: Project, file: ProjectFile) => {
      if (selectedProject?.id !== project.id) {
          setSelectedProject(project);
      }
      await loadNotebookContent(project.id, file.path);
      // Reset kernel state after loading is complete
      // await handleRestartKernel(); // Use reset instead
      await handleResetKernelState();

      // Update dependency array
  }, [loadNotebookContent, setSelectedProject, selectedProject?.id, handleResetKernelState]);

  // --- Effect to check screen size and adjust canvas panel ---
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth <= 480;
      setIsSmallScreen(isSmall);
      if (isSmall && showCanvasPanel) {
          setShowCanvasPanel(false);
          setCanvasPanelWidth(0);
      } else if (!isSmall && showCanvasPanel) {
          setCanvasPanelWidth(600);
      }
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [showCanvasPanel]);

  // URL Sync Hook
  useUrlSync({
    notebookMetadata,
    hasInitialized: hasInitializedRef.current,
  });

  // Run system cells on startup (Placed after hook definitions)
  useEffect(() => {
    const executeSystemCell = async () => {
      if (!isReady || !hasInitializedRef.current || systemCellsExecutedRef.current) return;
      const systemCell = cells.find(cell => cell.metadata?.role === CELL_ROLES.SYSTEM && cell.type === 'code');
      if (!systemCell) {
        systemCellsExecutedRef.current = true; // Mark as "executed" (or no-op if no system cell)
        return;
      }
      const systemCellId = systemCell.id;

      // --- Set the flag BEFORE the async operation that updates state ---
      systemCellsExecutedRef.current = true;

      try {
        // Now execute the cell
        await cellManager.current?.executeCell(systemCellId, true);
        // Hide output/code after execution completes
        cellManager.current?.hideCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
      } catch (error) {
        console.error('Error executing system cell:', error); // Keep error
        // Attempt to show output on error
        cellManager.current?.showCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
        // Optional: Reset flag on error if you want to retry?
        // systemCellsExecutedRef.current = false;
      }
    };
    executeSystemCell();
    // Keep dependencies: effect needs to run when kernel is ready or cells change initially.
    // The ref check prevents infinite loops after the flag is set.
  }, [isReady, cells, hasInitializedRef]);

  // --- Notebook Action Handlers ---
  const handleDownloadNotebook = useCallback(() => {
    if (!notebookMetadata) return;
    const notebookToSave: NotebookData = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: notebookMetadata,
      cells: cells,
    };
    const blob = new Blob([JSON.stringify(notebookToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = notebookMetadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `${safeTitle || 'untitled'}.ipynb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [notebookMetadata, cells]);

  const handleRunAllCells = useCallback(async () => {
    if (!cellManager.current) return;
    await cellManager.current.runAllCells();
    showToast('Finished running all cells', 'success');
  }, []);

  const handleClearAllOutputs = useCallback(() => {
    if (!cellManager.current) return;
    cellManager.current.clearAllOutputs();
    showToast('Cleared all outputs', 'success');
  }, []);

  // Add keyboard shortcut for saving notebook
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        console.log('Ctrl/Cmd+S detected, attempting to save notebook...');
        saveNotebook();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveNotebook]); // Dependency array includes saveNotebook

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header goes first and spans full width */}
          <NotebookHeader
            metadata={notebookMetadata}
        onMetadataChange={setNotebookMetadata}
        onSave={saveNotebook}
            onDownload={handleDownloadNotebook}
        onLoad={loadNotebookFromFile}
            onRunAll={handleRunAllCells}
            onClearOutputs={handleClearAllOutputs}
            onRestartKernel={handleRestartKernel}
            onAddCodeCell={handleAddCodeCell}
            onAddMarkdownCell={handleAddMarkdownCell}
            onShowKeyboardShortcuts={() => setIsShortcutsDialogOpen(true)}
            isProcessing={isProcessingAgentResponse}
        isKernelReady={isReady}
        isAIReady={isAIReady}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
          />

      {/* Container for Sidebar + Main Content Area (takes remaining height) */}
      <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <Sidebar
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onLoadNotebook={handleLoadNotebook}
        />

        {/* Original Main notebook content area (now next to Sidebar) */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-all duration-300">
          {/* Main content area with notebook and canvas panel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Notebook Content Area */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
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

              {/* Footer with chat input */}
                <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm pt-1 px-4 pb-4 shadow-md">
                  <NotebookFooter
                  onSendMessage={handleCommandOrSendMessage}
                    onStopChatCompletion={handleStopChatCompletion}
                    isProcessing={isProcessingAgentResponse}
                    isThebeReady={isReady}
                    isAIReady={isAIReady}
                    initializationError={initializationError}
                    agentSettings={agentSettings}
                  onSettingsChange={setAgentSettings}
                  />
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
                onClose={toggleCanvasPanel}
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

// Wrap NotebookPage with providers
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