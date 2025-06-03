/**
 * Hook for notebook operations (save, load, create)
 */

import { useCallback } from 'react';
import { NotebookData, NotebookMetadata, NotebookCell, CellRole } from '../types/notebook';
import { showToast, dismissToast } from '../utils/notebookUtils';
import { useProjects, IN_BROWSER_PROJECT } from '../providers/ProjectsProvider';
import { v4 as uuidv4 } from 'uuid';
import { CellManager } from '../pages/CellManager';

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

interface UseNotebookOperationsProps {
  cellManager: CellManager | null;
  notebookMetadata: NotebookMetadata;
  setNotebookMetadata: (metadata: NotebookMetadata | ((prev: NotebookMetadata) => NotebookMetadata)) => void;
  setCells: (cells: NotebookCell[]) => void;
  setExecutionCounter: (counter: number) => void;
  lastUserCellRef: React.MutableRefObject<string | null>;
  lastAgentCellRef: React.MutableRefObject<string | null>;
  setSelectedProject: (project: any) => void;
  isLoggedIn: boolean;
  artifactManager: any;
  resetKernelState: () => Promise<void>;
}

export const useNotebookOperations = ({
  cellManager,
  notebookMetadata,
  setNotebookMetadata,
  setCells,
  setExecutionCounter,
  lastUserCellRef,
  lastAgentCellRef,
  setSelectedProject,
  isLoggedIn,
  artifactManager,
  resetKernelState
}: UseNotebookOperationsProps) => {
  const {
    getFileContent,
    uploadFile,
    getInBrowserProject,
    saveInBrowserFile,
    getInBrowserFileContent,
    isLoading: isProjectsLoading,
    initialLoadComplete,
  } = useProjects();

  // Save notebook based on current notebookMetadata
  const saveNotebook = useCallback(async () => {
    if (!cellManager) {
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
      ...(cellManager.notebookMetadata),
      filePath: currentFilePath,
      modified: new Date().toISOString(),
    };
    const resolvedProjectId = metadataToSave.projectId || IN_BROWSER_PROJECT.id;

    if (!metadataToSave.filePath) {
        console.error('Save Failed: File path is still missing.');
        showToast('Cannot determine save file path.', 'error');
      return;
    }

    console.log('[Notebook Save] Attempting save to:', { projectId: resolvedProjectId, filePath: metadataToSave.filePath });
    showToast('Saving...', 'loading');

    try {
      setNotebookMetadata(metadataToSave);
      const notebookData: NotebookData = {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: metadataToSave,
        cells: cellManager.getCurrentCellsContent()
      };

      if (resolvedProjectId === IN_BROWSER_PROJECT.id) {
        await saveInBrowserFile(metadataToSave.filePath, notebookData);
      } else {
        console.log(`[Notebook Save] Saving to remote project: ${resolvedProjectId}`);
        const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
        const file = new File([blob], metadataToSave.filePath.split('/').pop() || 'notebook.ipynb', { type: 'application/json' });
        await uploadFile(resolvedProjectId, file);
      }
      showToast('Notebook saved successfully', 'success');
    } catch (error) {
      console.error('Error saving notebook:', error);
      showToast(`Failed to save notebook: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [cellManager, notebookMetadata, isProjectsLoading, uploadFile, saveInBrowserFile, setNotebookMetadata]);

  // Load notebook content
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
          console.warn('[Notebook] Load file cancelled: Projects provider not ready for remote project.', resolvedProjectId);
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
          projectId: resolvedProjectId,
          agentArtifact: notebookData.metadata?.agentArtifact || {
            id: '',
            name: notebookData.metadata?.title || filePath.split('/').pop() || 'Untitled Chat',
            description: 'An agent created from chat',
            version: '0.1.0',
            manifest: {
              name: notebookData.metadata?.title || filePath.split('/').pop() || 'Untitled Chat',
              description: 'An agent created from chat',
              version: '0.1.0',
              license: 'CC-BY-4.0',
              welcomeMessage: 'Hi, how can I help you today?',
              type: 'agent',
              created_at: new Date().toISOString()
            }
          }
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
        cellManager?.clearRunningState();

        showToast('Notebook loaded successfully', 'success');
        console.log('[Notebook] Notebook loading completed successfully');
      } else {
        console.warn('Invalid notebook file format found after parsing:', { projectId: resolvedProjectId, filePath });
        throw new Error('Invalid notebook file format');
      }
    } catch (error) {
      console.error('Error loading file content:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('timeout')) {
        showToast(`Loading timed out: ${errorMessage}`, 'error');
      } else {
        showToast(`Failed to load notebook: ${errorMessage}`, 'error');
      }
      
      setCells([]);
      setNotebookMetadata(defaultNotebookMetadata);
      setExecutionCounter(1);
      lastUserCellRef.current = null;
      lastAgentCellRef.current = null;
      setSelectedProject(null);
    } finally {
      dismissToast(loadingToastId);
    }
  }, [
    isProjectsLoading,
    initialLoadComplete,
    getFileContent,
    getInBrowserFileContent,
    setNotebookMetadata,
    setCells,
    setExecutionCounter,
    setSelectedProject,
    cellManager
  ]);

  // Handle loading notebook from file input
  const loadNotebookFromFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const loadedNotebookData: NotebookData = JSON.parse(content);
        const newFilePath = `${file.name}`;

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
        setSelectedProject(getInBrowserProject());
        const notebookToSave: NotebookData = {
          nbformat: 4,
          nbformat_minor: 5,
          metadata: metadata,
          cells: cellsToLoad
        };
        await saveInBrowserFile(newFilePath, notebookToSave)
          .then(() => console.log(`Saved uploaded file to in-browser: ${newFilePath}`))
          .catch(err => console.error(`Failed to auto-save uploaded file: ${err}`));

        setSelectedProject(getInBrowserProject());
        await resetKernelState();

      } catch (error) {
        console.error('Error loading notebook from file:', error);
        showToast('Failed to load notebook file', 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [saveInBrowserFile, setSelectedProject, getInBrowserProject, resetKernelState, setNotebookMetadata, setCells, setExecutionCounter]);

  // Download notebook
  const handleDownloadNotebook = useCallback(() => {
    if (!notebookMetadata) return;
    const notebookToSave: NotebookData = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: notebookMetadata,
      cells: cellManager?.getCurrentCellsContent() || [],
    };
    const blob = new Blob([JSON.stringify(notebookToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = notebookMetadata.filePath?.split('/').pop() || 'notebook.ipynb';
    a.download = fileName.endsWith('.ipynb') ? fileName : `${fileName}.ipynb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [notebookMetadata, cellManager]);

  // Create notebook from agent template
  const createNotebookFromAgentTemplate = useCallback(async (agentId: string, projectId?: string) => {
    if (!artifactManager || !isLoggedIn) {
      showToast('You need to be logged in to create a notebook from an agent template', 'error');
      return;
    }

    const loadingToastId = 'creating-notebook';
    showToast('Creating notebook from agent template...', 'loading', { id: loadingToastId });

    try {
      const agent = await artifactManager.read({ artifact_id: agentId, _rkwargs: true });
      if (!agent || !agent.manifest) {
        throw new Error('Agent not found or invalid manifest');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = `${agent.manifest.name}_${timestamp}.ipynb`;
      const resolvedProjectId = projectId || IN_BROWSER_PROJECT.id;

      let cells = [];
      const template = agent.manifest.chat_template || {};

      if (template.cells && template.cells.length > 0) {
        console.log('[Notebook] Using cells from agent chat template');
        cells = template.cells;
      } else if (agent.manifest.startup_script) {
        console.log('[Notebook] Creating system cell with agent startup script');
        const systemCellContent = agent.manifest.startup_script;
        cells.push({
          id: uuidv4(),
          type: 'code',
          content: systemCellContent,
          executionState: 'idle',
          metadata: {
            trusted: true,
            role: 'system'
          },
          executionCount: undefined,
          output: []
        });

        if (agent.manifest.welcomeMessage) {
          console.log('[Notebook] Adding welcome message cell');
          cells.push({
            id: uuidv4(),
            type: 'markdown',
            content: agent.manifest.welcomeMessage,
            executionState: 'idle',
            metadata: {
              trusted: true,
              role: 'assistant'
            },
            executionCount: undefined,
            output: []
          });
        }
      }

      const notebookData: NotebookData = {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: {
          ...defaultNotebookMetadata,
          ...(template.metadata ? {
            title: template.metadata.title,
            description: template.metadata.description,
          } : {}),
          title: agent.manifest.name || 'Agent Chat',
          modified: new Date().toISOString(),
          created: new Date().toISOString(),
          filePath: filePath,
          projectId: resolvedProjectId,
          agentArtifact: {
            id: agent.id,
            version: agent.version,
            name: agent.manifest.name,
            description: agent.manifest.description,
            manifest: {
              ...agent.manifest,
            }
          }
        },
        cells: cells
      };

      if (resolvedProjectId === IN_BROWSER_PROJECT.id) {
        await saveInBrowserFile(filePath, notebookData);
        setSelectedProject(getInBrowserProject());
      } else {
        const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
        const file = new File([blob], filePath.split('/').pop() || 'notebook.ipynb', { type: 'application/json' });
        await uploadFile(resolvedProjectId, file);
      }

      await loadNotebookContent(resolvedProjectId, filePath);
      showToast('Notebook created successfully', 'success');
      dismissToast(loadingToastId);

    } catch (error) {
      console.error('Error creating notebook from agent template:', error);
      showToast(`Failed to create notebook: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      dismissToast(loadingToastId);
    }
  }, [
    artifactManager,
    isLoggedIn,
    saveInBrowserFile,
    uploadFile,
    loadNotebookContent,
    setSelectedProject,
    getInBrowserProject
  ]);

  // Create new notebook
  const handleCreateNewNotebook = useCallback(async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `Untitled_Chat_${timestamp}.ipynb`;

    const notebookData: NotebookData = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        ...defaultNotebookMetadata,
        title: 'New Chat',
        modified: new Date().toISOString(),
        created: new Date().toISOString(),
        filePath: filePath,
        projectId: IN_BROWSER_PROJECT.id,
        agentArtifact: {
          id: '',
          name: 'New Agent',
          description: 'A new agent created from chat',
          version: '0.1.0',
          manifest: {
            name: 'New Agent',
            description: 'A new agent created from chat',
            version: '0.1.0',
            license: 'CC-BY-4.0',
            welcomeMessage: 'Hi, how can I help you today?',
            type: 'agent',
            created_at: new Date().toISOString()
          }
        }
      },
      cells: []
    };

    try {
      await saveInBrowserFile(filePath, notebookData);
      setSelectedProject(getInBrowserProject());
      await loadNotebookContent(IN_BROWSER_PROJECT.id, filePath);
      showToast('Created new chat notebook', 'success');
    } catch (error) {
      console.error('Error creating new notebook:', error);
      showToast(`Failed to create notebook: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [saveInBrowserFile, setSelectedProject, getInBrowserProject, loadNotebookContent]);

  return {
    saveNotebook,
    loadNotebookContent,
    loadNotebookFromFile,
    handleDownloadNotebook,
    createNotebookFromAgentTemplate,
    handleCreateNewNotebook
  };
}; 