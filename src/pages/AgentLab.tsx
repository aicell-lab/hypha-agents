import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FaSpinner } from 'react-icons/fa';
import '../styles/ansi.css';
import '../styles/notebook.css';
import { useHyphaStore } from '../store/hyphaStore';
import { CellManager } from './CellManager';
import { loadModelSettings } from '../utils/modelSettings';
import { HyphaCoreWindow } from '../components/notebook/CanvasPanel';
import { v4 as uuidv4 } from 'uuid';
import ModelSettingsCanvasContent from '../components/notebook/ModelSettingsCanvasContent';
import EditAgentCanvasContent, { EditAgentFormData } from '../components/notebook/EditAgentCanvasContent';

// Import utilities and types
import { NotebookCell, NotebookMetadata, CellType, CellRole } from '../types/notebook';
import { showToast, dismissToast } from '../utils/notebookUtils';
import { SITE_ID } from '../utils/env';
import { ChatMessage } from '../utils/chatCompletion';

// Import hooks
import { useChatCompletion } from '../hooks/useChatCompletion';
import { useNotebookCommands } from '../hooks/useNotebookCommands';
import { useNotebookInitialization } from '../hooks/useNotebookInitialization';
import { useUrlSync } from '../hooks/useUrlSync';
import { useNotebookKeyboardShortcuts } from '../hooks/useNotebookKeyboardShortcuts';
import { useKernelManager } from '../hooks/useKernelManager';
import { useNotebookOperations } from '../hooks/useNotebookOperations';
import { useAgentOperations } from '../hooks/useAgentOperations';
import { useCanvasPanel } from '../hooks/useCanvasPanel';
import { useSidebar } from '../hooks/useSidebar';

// Import types from ProjectsProvider
import type { Project as BaseProject } from '../providers/ProjectsProvider';
import { ProjectsProvider, useProjects, IN_BROWSER_PROJECT } from '../providers/ProjectsProvider';

// Import setupNotebookService
import { setupNotebookService } from '../components/services/hyphaCoreServices';

// Import the hook's return type
import { InitialUrlParams } from '../hooks/useNotebookInitialization';

// Import layout component
import { AgentLabLayout } from '../components/AgentLabLayout';
import { DenoTerminalPanel } from '../components/DenoTerminalPanel';

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
  filePath: undefined,
  projectId: undefined
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

interface Project extends BaseProject {
  manifest: ProjectManifest;
}

const NotebookPage: React.FC = () => {
  // Core state
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [executionCounter, setExecutionCounter] = useState(1);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const systemCellsExecutedRef = useRef(false);
  const [notebookMetadata, setNotebookMetadata] = useState<NotebookMetadata>(defaultNotebookMetadata);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const editorRefs = useRef<{ [key: string]: React.RefObject<any> }>({});
  const lastUserCellRef = useRef<string | null>(null);
  const lastAgentCellRef = useRef<string | null>(null);
  const { server, isLoggedIn, artifactManager } = useHyphaStore();
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isAIReady, setIsAIReady] = useState(false);
  const [agentSettings, setAgentSettings] = useState(() => loadModelSettings());
  const [hyphaCoreApi, setHyphaCoreApi] = useState<any>(null);
  const isLoadingFromUrlRef = useRef(false);
  
  const {
    selectedProject,
    setSelectedProject,
    getInBrowserProject,
    isLoading: isProjectsLoading,
    initialLoadComplete,
    projects,
  } = useProjects();
  
  // Additional state
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [parsedUrlParams, setParsedUrlParams] = useState<InitialUrlParams | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  
  // Initialize the cell manager
  const cellManager = useRef<CellManager | null>(null);

  // State to prevent multiple simultaneous service setups
  const [isSettingUpService, setIsSettingUpService] = useState(false);

  // Ref to store the AbortController for Hypha service setup
  const hyphaServiceAbortControllerRef = useRef<AbortController>(new AbortController());

  // Initialize canvas panel and sidebar hooks early
  const canvasPanel = useCanvasPanel();
  const sidebar = useSidebar();

  // Initialization Hook
  const { hasInitialized: initRefObject, initialUrlParams } = useNotebookInitialization({
    isLoggedIn,
    initialLoadComplete,
    setSelectedProject,
    getInBrowserProject,
    setNotebookMetadata,
    setCells,
    setExecutionCounter,
    defaultNotebookMetadata,
    cellManagerRef: cellManager,
    projects,
  });

  // Define handleAddWindow callback early
  const handleAddWindow = useCallback((config: any) => {
    canvasPanel.setHyphaCoreWindows(prev => {
      if (prev.some(win => win.id === config.window_id)) {
        return prev;
      }
      const newWindow: HyphaCoreWindow = {
        id: config.window_id,
        src: config.src,
        name: config.name || `${config.src || 'Untitled Window'}`
      };
      return [...prev, newWindow];
    });
    canvasPanel.setActiveCanvasTab(config.window_id);
    canvasPanel.setShowCanvasPanel(true);
  }, [canvasPanel]);

  // Setup service with kernel when ready
  const setupServiceWithKernel = useCallback(async (executeCode: (code: string, callbacks?: any, timeout?: number) => Promise<void>) => {
    if (isSettingUpService) {
      console.log('[AgentLab] Service setup already in progress, skipping');
      return;
    }
    
    setIsSettingUpService(true);
    setHyphaCoreApi(null);
    
    if(!server) {
      showToast('Hypha Core Service is not available, please login.', 'warning');
      setIsSettingUpService(false);
      return;
    }
    
    console.log('[AgentLab] Setting up Hypha Core service with ready kernel');
    const currentSignal = hyphaServiceAbortControllerRef.current.signal;
    try {
      const api = await setupNotebookService({
        onAddWindow: handleAddWindow,
        server, 
        executeCode: executeCode,
        agentSettings,
        abortSignal: currentSignal,
        projectId: selectedProject?.id || IN_BROWSER_PROJECT.id,
      });
      if (currentSignal.aborted) {
          console.log('[AgentLab] Hypha Core service setup aborted before completion.');
          return;
      }
      setHyphaCoreApi(api);
      console.log('[AgentLab] Hypha Core service successfully set up.');
      showToast('Hypha Core Service Connected', 'success');
    } catch (error: any) {
      if (error.name === 'AbortError') {
          console.log('[AgentLab] Hypha Core service setup explicitly aborted.');
      } else {
          console.error('[AgentLab] Failed to set up notebook service:', error);
          showToast(`Failed to connect Hypha Core Service: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      setHyphaCoreApi(null);
    } finally {
      setIsSettingUpService(false);
    }
  }, [isSettingUpService, server, agentSettings, selectedProject, handleAddWindow]);

  // Initialize hooks
  const kernelManager = useKernelManager({ 
    server, 
    clearRunningState: () => cellManager.current?.clearRunningState(),
    onKernelReady: setupServiceWithKernel
  });
  
  const notebookOps = useNotebookOperations({
    cellManager: cellManager.current,
    notebookMetadata,
    setNotebookMetadata,
    setCells,
    setExecutionCounter,
    lastUserCellRef,
    lastAgentCellRef,
    setSelectedProject,
    isLoggedIn,
    artifactManager,
    resetKernelState: kernelManager.resetKernelState
  });

  const agentOps = useAgentOperations(
            cells,
            notebookMetadata,
    setCells,
    setNotebookMetadata,
    useRef(kernelManager.executeCode),
    () => {} // setCanvasPanelComponent placeholder
  );

  // Add the keyboard shortcuts hook
  useNotebookKeyboardShortcuts({
    cellManager: cellManager.current,
    isEditing
  });

  // Initialize cell manager
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
      kernelManager.executeCode,
    );
  } else {
    // Update the references when they change
    cellManager.current.cells = cells;
    cellManager.current.activeCellId = activeCellId;
    cellManager.current.executionCounter = executionCounter;
    cellManager.current.notebookMetadata = notebookMetadata;
    cellManager.current.executeCodeFn = kernelManager.executeCode;
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
    }
  }, [kernelManager.executeCode]);

  // Notebook Commands Hook
  const { handleCommand } = useNotebookCommands({
    cellManager: cellManager.current,
    hasInitialized: initRefObject
  });

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
    isReady: kernelManager.isReady,
    setCells
  });

  // Handle abort execution
  const handleAbortExecution = useCallback(async () => {
    console.log('[AgentLab] Aborting execution...');
    
    // Interrupt kernel execution
    await kernelManager.interruptKernel();
    
    // Also abort Hypha Core service operations
    hyphaServiceAbortControllerRef.current.abort();
    hyphaServiceAbortControllerRef.current = new AbortController();
    handleStopChatCompletion();
  }, [kernelManager, handleStopChatCompletion]);

  // Handle interrupt kernel execution
  const handleInterruptKernel = useCallback(async () => {
    await kernelManager.interruptKernel();

  }, [kernelManager]);

  // Cell action handlers
  const handleActiveCellChange = useCallback((id: string) => cellManager.current?.setActiveCell(id), []);
  const handleExecuteCell = useCallback((id: string): Promise<string> => {
    return cellManager.current?.executeCell(id, true) || Promise.resolve('Error: CellManager not ready');
  }, []);
  const handleUpdateCellContent = useCallback((id: string, content: string) => cellManager.current?.updateCellContent(id, content), []);
  const handleToggleCellEditing = useCallback((id: string, editing: boolean) => {
    setIsEditing(editing);
    cellManager.current?.toggleCellEditing(id, editing);
  }, []);
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

  // Additional handlers for canvas operations
  const handleShowDenoTerminalInCanvas = useCallback(() => {
    const windowId = 'deno-terminal';
    const windowExists = canvasPanel.hyphaCoreWindows.some(win => win.id === windowId);

    if (!windowExists) {
      const newWindow: HyphaCoreWindow = {
        id: windowId,
        name: 'Deno Terminal',
        component: (
          <DenoTerminalPanel 
            server={server}
            kernelInfo={kernelManager.kernelInfo}
            executeCode={kernelManager.executeCode}
          />
        )
      };
      canvasPanel.setHyphaCoreWindows(prev => [...prev, newWindow]);
    }

    canvasPanel.setActiveCanvasTab(windowId);
    canvasPanel.setShowCanvasPanel(true);
  }, [canvasPanel, server, kernelManager]);

  // Handler to save agent settings from canvas to notebook metadata
  const handleSaveAgentSettingsToNotebook = useCallback((data: EditAgentFormData) => {
    // Update or create agent artifact metadata
    const agentArtifactMeta = notebookMetadata.agentArtifact ? {
      ...notebookMetadata.agentArtifact,
      id: data.agentId || notebookMetadata.agentArtifact.id || '', // Preserve existing ID if not provided
      name: data.name,
      description: data.description,
      version: data.version,
      manifest: {
        ...(notebookMetadata.agentArtifact.manifest || {}),
        name: data.name,
        description: data.description,
        version: data.version,
        license: data.license,
        welcomeMessage: data.welcomeMessage,
        startup_script: data.initialPrompt,
      }
    } : {
      // Create minimal structure if no artifact existed before
      id: data.agentId || '',
      name: data.name,
      description: data.description,
      version: data.version,
      manifest: {
        name: data.name,
        description: data.description,
        version: data.version,
        license: data.license,
        welcomeMessage: data.welcomeMessage,
        startup_script: data.initialPrompt,
      }
    };

    // Update notebook metadata with agent configuration
    setNotebookMetadata(prev => ({
      ...prev,
      title: data.name, // Update notebook title too
      agentArtifact: agentArtifactMeta,
      modified: new Date().toISOString()
    }));

    // Save notebook and show success message
    notebookOps.saveNotebook();
    showToast('Agent settings saved to notebook', 'success');
  }, [notebookMetadata, setNotebookMetadata, notebookOps.saveNotebook]);

  // Handler to publish agent from canvas
  const handlePublishAgentFromCanvas = useCallback(async (data: EditAgentFormData, isUpdating: boolean): Promise<string | null> => {
    if (!artifactManager || !isLoggedIn) {
      showToast('You need to be logged in to publish an agent', 'error');
      return null;
    }

    const toastId = 'publishing-agent-canvas';
    showToast('Publishing agent...', 'loading', { id: toastId });

    // Ensure notebook is saved before publishing
    await notebookOps.saveNotebook();

    try {
      // Get system cell content for the startup script
      const systemCell = cells.find(cell => cell.metadata?.role === CELL_ROLES.SYSTEM && cell.type === 'code');
      const systemCellContent = systemCell ? systemCell.content : '';

      // Create comprehensive agent manifest
      const manifest = {
        name: data.name,
        description: data.description,
        version: data.version,
        license: data.license,
        type: 'agent',
        created_at: new Date().toISOString(),
        startup_script: systemCellContent,
        welcomeMessage: data.welcomeMessage,
        modelConfig: agentSettings, // Include current model settings
        // Preserve notebook state in chat template
        chat_template: {
          metadata: notebookMetadata,
          cells: cellManager.current?.getCurrentCellsContent() || []
        }
      };

      console.log('[AgentLab] Publishing agent:', {
        isUpdating,
        agentId: data.agentId,
        manifest: { ...manifest, startup_script: '<<SCRIPT>>' } // Log without full script
      });

      let artifact;

      if (isUpdating && data.agentId) {
        // Update existing agent
        console.log('[AgentLab] Updating existing agent:', data.agentId);
        artifact = await artifactManager.edit({
          artifact_id: data.agentId,
          type: "agent",
          manifest: manifest,
          version: manifest.version,
          _rkwargs: true
        });
        console.log('[AgentLab] Agent updated successfully:', artifact);
        dismissToast(toastId);
        showToast('Agent updated successfully!', 'success');
      } else {
        // Create new agent
        console.log('[AgentLab] Creating new agent');
        artifact = await artifactManager.create({
          parent_id: `${SITE_ID}/agents`,
          type: "agent",
          manifest: manifest,
          _rkwargs: true
        });
        console.log('[AgentLab] Agent created successfully:', artifact);
        dismissToast(toastId);
        showToast('Agent published successfully!', 'success');
      }

      // Update notebook metadata with published artifact info
      const finalAgentArtifactMeta = {
        id: artifact.id,
        version: artifact.version,
        name: manifest.name,
        description: manifest.description,
        manifest: manifest
      };

      setNotebookMetadata(prev => ({
        ...prev,
        title: manifest.name, // Ensure title matches published agent
        agentArtifact: finalAgentArtifactMeta,
        modified: new Date().toISOString()
      }));

      // Save notebook again to persist artifact ID and version
      await notebookOps.saveNotebook();

      return artifact.id; // Return ID on success

    } catch (error) {
      console.error('Error publishing agent from canvas:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`Failed to publish agent: ${errorMessage}`, 'error', { id: toastId });
      return null;
    }
  }, [
    artifactManager, 
    isLoggedIn, 
    cells, 
    notebookMetadata, 
    notebookOps.saveNotebook,
    setNotebookMetadata, 
    cellManager, 
    showToast, 
    dismissToast, 
    agentSettings
  ]);

  // Wrapper function to handle edit agent with the expected signature
  const handleEditAgentWrapper = useCallback(async (workspace: string, agentId: string) => {
    // Convert the workspace and agentId parameters to EditAgentFormData
    const formData: EditAgentFormData = {
      agentId: agentId,
      name: agentId, // Use agentId as name for now
      description: '', // Default empty description
      version: '0.1.0', // Default version
      license: 'CC-BY-4.0', // Default license
      welcomeMessage: 'Hi, how can I help you today?', // Default welcome message
      initialPrompt: '', // Default empty initial prompt
      modelConfig: {
        baseURL: agentSettings.baseURL,
        apiKey: agentSettings.apiKey,
        model: agentSettings.model,
        temperature: agentSettings.temperature
      }
    };
    
    await agentOps.handleEditAgent(formData);
  }, [agentOps, agentSettings]);

  const handleShowModelSettingsInCanvas = useCallback(() => {
    const windowId = 'model-settings';
    const windowExists = canvasPanel.hyphaCoreWindows.some(win => win.id === windowId);

    if (windowExists) {
      canvasPanel.setActiveCanvasTab(windowId);
      canvasPanel.setShowCanvasPanel(true);
      return;
    }

    const newWindow: HyphaCoreWindow = {
      id: windowId,
      name: 'Model Settings',
      component: (
        <ModelSettingsCanvasContent
          onSettingsChange={setAgentSettings}
        />
      )
    };

    canvasPanel.setHyphaCoreWindows(prev => [...prev, newWindow]);
    canvasPanel.setActiveCanvasTab(windowId);
    canvasPanel.setShowCanvasPanel(true);
  }, [canvasPanel, setAgentSettings]);

  const handleShowEditAgentInCanvas = useCallback(() => {
    const agentArtifact = notebookMetadata.agentArtifact;
    const systemCell = cells.find(cell => cell.metadata?.role === CELL_ROLES.SYSTEM && cell.type === 'code');

    const initialAgentData: Partial<EditAgentFormData> = {
      agentId: agentArtifact?.id || '',
      name: agentArtifact?.name || notebookMetadata.title || '',
      description: agentArtifact?.description || '',
      version: agentArtifact?.version || '0.1.0',
      license: agentArtifact?.manifest?.license || 'CC-BY-4.0',
      welcomeMessage: agentArtifact?.manifest?.welcomeMessage || 'Hi, how can I help you today?',
      initialPrompt: systemCell ? systemCell.content : ''
    };

    const windowId = 'edit-agent-config';
    const windowExists = canvasPanel.hyphaCoreWindows.some(win => win.id === windowId);

    if (windowExists) {
      canvasPanel.setHyphaCoreWindows(prev => prev.map(win => {
        if (win.id === windowId) {
          return {
            ...win,
            name: `Edit: ${initialAgentData.name || 'Agent'}`,
            component: (
              <EditAgentCanvasContent
                initialAgentData={initialAgentData}
                onSaveSettingsToNotebook={handleSaveAgentSettingsToNotebook}
                onPublishAgent={handlePublishAgentFromCanvas}
              />
            )
          };
        }
        return win;
      }));
    } else {
      const newWindow: HyphaCoreWindow = {
        id: windowId,
        name: `Edit: ${initialAgentData.name || 'Agent'}`,
        component: (
          <EditAgentCanvasContent
            initialAgentData={initialAgentData}
            onSaveSettingsToNotebook={handleSaveAgentSettingsToNotebook}
            onPublishAgent={handlePublishAgentFromCanvas}
          />
        )
      };
      canvasPanel.setHyphaCoreWindows(prev => [...prev, newWindow]);
    }

    canvasPanel.setActiveCanvasTab(windowId);
    canvasPanel.setShowCanvasPanel(true);
  }, [notebookMetadata, cells, canvasPanel]);

  // Move cell handlers
  const handleMoveCellUp = useCallback(() => {
    if (!activeCellId || !cellManager.current) return;
    cellManager.current.moveCellUp(activeCellId);
    cellManager.current.scrollCellIntoView(activeCellId);
  }, [activeCellId]);

  const handleMoveCellDown = useCallback(() => {
    if (!activeCellId || !cellManager.current) return;
    cellManager.current.moveCellDown(activeCellId);
    cellManager.current.scrollCellIntoView(activeCellId);
  }, [activeCellId]);

  const canMoveUp = useMemo(() => {
    if (!activeCellId || !cellManager.current) return false;
    const cellIndex = cells.findIndex(cell => cell.id === activeCellId);
    return cellIndex > 0;
  }, [activeCellId, cells]);

  const canMoveDown = useMemo(() => {
    if (!activeCellId || !cellManager.current) return false;
    const cellIndex = cells.findIndex(cell => cell.id === activeCellId);
    return cellIndex < cells.length - 1;
  }, [activeCellId, cells]);

  // Handle sending a message with command checking
  const handleCommandOrSendMessage = useCallback((message: string) => {
    if (!kernelManager.isReady) {
      setInitializationError("AI assistant is not ready. Please wait.");
      return;
    }
    if (message.startsWith('/') || message.startsWith('#')) {
      handleCommand(message);
      return;
    }
    cellManager.current?.clearRunningState();
    handleSendChatMessage(message);
  }, [kernelManager.isReady, handleCommand, handleSendChatMessage, setInitializationError]);

  // Calculate the filename from the filePath in metadata
  const notebookFileName = useMemo(() => {
    if (!notebookMetadata.filePath) {
      return '';
    }
    const parts = notebookMetadata.filePath.split('/');
    return parts[parts.length - 1] || 'Untitled_Chat';
  }, [notebookMetadata.filePath]);

  // Notebook action handlers
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

  // Load notebook from file
  const handleLoadNotebook = useCallback(async (project: Project, file: any) => {
      // If switching to a different project, cleanup current kernel
      if (selectedProject?.id !== project.id && kernelManager.destroyCurrentKernel) {
        console.log('[AgentLab] Switching projects, cleaning up current kernel');
        await kernelManager.destroyCurrentKernel();
      }
      
      if (selectedProject?.id !== project.id) {
          setSelectedProject(project);
      }
      await notebookOps.loadNotebookContent(project.id, file.path);
      await kernelManager.resetKernelState();
  }, [notebookOps.loadNotebookContent, setSelectedProject, selectedProject?.id, kernelManager.resetKernelState, kernelManager.destroyCurrentKernel]);

  // Effects
  useEffect(() => {
    const checkScreenSize = () => {
      const small = window.innerWidth <= 480;
      setIsSmallScreen(small);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    if (isSmallScreen && canvasPanel.showCanvasPanel && canvasPanel.hyphaCoreWindows.length === 0) {
      canvasPanel.setShowCanvasPanel(false);
    }
  }, [isSmallScreen, canvasPanel]);

  // URL Sync Hook
  useUrlSync({
    notebookMetadata,
    hasInitialized: !showWelcomeScreen && initRefObject.current,
  });

  // Run system cells on startup - wait for Hypha Core service to be ready
  useEffect(() => {
    const executeSystemCell = async () => {
      // Wait for all initialization to complete including Hypha Core service setup
      if (showWelcomeScreen || !kernelManager.isReady || !initRefObject.current || systemCellsExecutedRef.current || !hyphaCoreApi) {

        return;
      }
      
      const systemCell = cells.find(cell => cell.metadata?.role === CELL_ROLES.SYSTEM && cell.type === 'code');
      if (!systemCell) {
        console.log('[AgentLab] No system cell found, marking as executed');
        systemCellsExecutedRef.current = true;
        return;
      }
      
      const systemCellId = systemCell.id;
      console.log('[AgentLab] Executing system cell after full initialization');
      systemCellsExecutedRef.current = true;

      try {
        await cellManager.current?.executeCell(systemCellId, true);
        cellManager.current?.hideCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
        console.log('[AgentLab] System cell executed successfully');
      } catch (error) {
        console.error('[AgentLab] Error executing system cell:', error);
        cellManager.current?.showCellOutput(systemCellId);
        cellManager.current?.hideCode(systemCellId);
      }
    };
    executeSystemCell();
  }, [showWelcomeScreen, kernelManager.isReady, cells, initRefObject.current, hyphaCoreApi, cellManager]);

  // Set AI readiness based on kernel readiness
  useEffect(() => {
    if (kernelManager.isReady) {
      console.log('[AgentLab] Kernel is ready, setting AI ready state to true.');
      setIsAIReady(true);
    } else {
      console.log('[AgentLab] Kernel is not ready, setting AI ready state to false.');
      setIsAIReady(false);
    }
  }, [kernelManager.isReady, setIsAIReady]);

  // Load agent settings from localStorage on component mount
  useEffect(() => {
    const settings = loadModelSettings();
    console.log('[AgentLab] Loading agent settings from localStorage.', settings);
    setAgentSettings(settings);
  }, []);

  // Store parsed params once initialization is done and set welcome screen visibility
  useEffect(() => {
    if (initRefObject.current && initialUrlParams) {
      setParsedUrlParams(initialUrlParams);
      
      if (!isLoggedIn) {
        console.log('[AgentLab] User not logged in, showing welcome screen');
        setShowWelcomeScreen(true);
        return;
      }
      
      if (initialUrlParams.filePath) {
        console.log(`[AgentLab] File URL parameter detected, loading: ${initialUrlParams.filePath}`);
        const projectId = initialUrlParams.projectId || IN_BROWSER_PROJECT.id;
        
        // Only load if we haven't already loaded this file and not currently loading (prevent duplicate loading)
        if (notebookMetadata.filePath !== initialUrlParams.filePath && !isLoadingFromUrlRef.current) {
          isLoadingFromUrlRef.current = true;
          notebookOps.loadNotebookContent(projectId, initialUrlParams.filePath)
            .then(() => {
              console.log(`[AgentLab] Successfully loaded file from URL parameter: ${initialUrlParams.filePath}`);
              if (isLoggedIn) {
                setShowWelcomeScreen(false);
              }
            })
            .catch(error => {
              console.error(`[AgentLab] Error loading file from URL parameter:`, error);
              setShowWelcomeScreen(true);
            })
            .finally(() => {
              isLoadingFromUrlRef.current = false;
            });
        } else {
          console.log(`[AgentLab] File already loaded or loading in progress, hiding welcome screen`);
          setShowWelcomeScreen(false);
        }
        return;
      }
      
      const shouldShowWelcome = !initialUrlParams.filePath;
      setShowWelcomeScreen(!isLoggedIn || shouldShowWelcome);
      if (initialUrlParams.edit) {
        console.log('[AgentLab] Edit parameter detected:', initialUrlParams.edit);
      }
    }
  }, [initRefObject.current, initialUrlParams, notebookOps.loadNotebookContent, isLoggedIn, notebookMetadata.filePath]);

  // Handle login state changes
  useEffect(() => {
    if (!isLoggedIn) {
      console.log('[AgentLab] User logged out or not logged in, showing welcome screen');
      setShowWelcomeScreen(true);
    }
  }, [isLoggedIn]);

  // Hide welcome screen when a notebook is loaded
  useEffect(() => {
    if (isLoggedIn && notebookMetadata.filePath) {
      console.log('[AgentLab] Notebook loaded with file path, hiding welcome screen');
      setShowWelcomeScreen(false);
    }
  }, [isLoggedIn, notebookMetadata.filePath]);

  // Keyboard shortcut for saving notebook
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showWelcomeScreen) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        console.log('Ctrl/Cmd+S detected, attempting to save notebook...');
        notebookOps.saveNotebook();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notebookOps.saveNotebook, showWelcomeScreen]);

  if (!initRefObject.current) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Initializing Agent Lab</h2>
          <p className="text-gray-600">Setting up your workspace...</p>
          {!kernelManager.isReady && (
            <div className="mt-4 text-sm text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <FaSpinner className="w-4 h-4 animate-spin" />
                <span>Kernel Status: {kernelManager.kernelStatus}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AgentLabLayout
      // Core state
      cells={cells}
      notebookMetadata={notebookMetadata}
      activeCellId={activeCellId}
      isLoggedIn={isLoggedIn}
      showWelcomeScreen={showWelcomeScreen}
      isShortcutsDialogOpen={isShortcutsDialogOpen}
      setIsShortcutsDialogOpen={setIsShortcutsDialogOpen}
      
      // Notebook operations
      notebookFileName={notebookFileName}
      onSave={notebookOps.saveNotebook}
      onDownload={notebookOps.handleDownloadNotebook}
      onLoad={notebookOps.loadNotebookFromFile}
        onRunAll={handleRunAllCells}
        onClearOutputs={handleClearAllOutputs}
      onRestartKernel={kernelManager.restartKernel}
        onAddCodeCell={handleAddCodeCell}
        onAddMarkdownCell={handleAddMarkdownCell}
      onCreateNewNotebook={notebookOps.handleCreateNewNotebook}
      onCreateAgentTemplate={agentOps.handleCreateAgent}
      onEditAgent={handleEditAgentWrapper}
      onStartFromAgent={notebookOps.createNotebookFromAgentTemplate}
      onOpenFile={notebookOps.loadNotebookContent}
      
      // Cell operations
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
      onMoveCellUp={handleMoveCellUp}
      onMoveCellDown={handleMoveCellDown}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      
      // Sidebar state
      isSidebarOpen={sidebar.isSidebarOpen}
      onToggleSidebar={() => sidebar.setIsSidebarOpen(!sidebar.isSidebarOpen)}
      sidebarWidth={sidebar.sidebarWidth}
      onSidebarResize={sidebar.handleSidebarResize}
      onSidebarResizeEnd={sidebar.handleSidebarResizeEnd}
      onLoadNotebook={handleLoadNotebook}
      
      // Canvas panel state
      showCanvasPanel={canvasPanel.showCanvasPanel}
      canvasPanelWidth={canvasPanel.canvasPanelWidth}
      hyphaCoreWindows={canvasPanel.hyphaCoreWindows}
      activeCanvasTab={canvasPanel.activeCanvasTab}
      onCanvasPanelResize={canvasPanel.handleCanvasPanelResize}
      onCanvasPanelResizeEnd={canvasPanel.handleCanvasPanelResizeEnd}
      onCanvasPanelClose={canvasPanel.toggleCanvasPanel}
      onCanvasTabChange={canvasPanel.setActiveCanvasTab}
      onCanvasTabClose={canvasPanel.handleTabClose}
      
      // Footer and messaging
                    onSendMessage={handleCommandOrSendMessage}
      onAbortExecution={handleAbortExecution}
      onInterruptKernel={handleInterruptKernel}
                    onShowTerminal={handleShowDenoTerminalInCanvas}
                    onModelSettingsChange={handleShowModelSettingsInCanvas}
                    onShowEditAgent={handleShowEditAgentInCanvas}
      
      // Status
      isProcessing={isProcessingAgentResponse}
      isReady={kernelManager.isReady}
      kernelStatus={kernelManager.kernelStatus}
      isAIReady={isAIReady}
      initializationError={initializationError}
      activeAbortController={activeAbortController}
      
      // URL params
      parsedUrlParams={parsedUrlParams}
    />
  );
};

// Wrap NotebookPage with providers
const AgentLab: React.FC = () => {
  return (
      <ProjectsProvider>
        <NotebookPage />
      </ProjectsProvider>
  );
};

export default AgentLab;