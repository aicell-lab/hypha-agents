/**
 * Hook for notebook operations (save, load, create)
 */

import { useCallback } from 'react';
import { NotebookData, NotebookMetadata, NotebookCell, CellRole, OutputItem } from '../types/notebook';
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

// Helper to convert internal cell format to standard notebook format
const toStandardCell = (cell: NotebookCell): any => {
  const { type, content, output, executionCount, ...rest } = cell;
  // Convert content string to source array (split by lines, keep ends)
  const source = typeof content === 'string' 
      ? content.split('\n').map((line, index, arr) => index === arr.length - 1 ? line : line + '\n') 
      : content || [];
      
  const standardCell: any = {
    ...rest,
    cell_type: type,
    source: source,
    metadata: cell.metadata || {}
  };

  if (type === 'code') {
    standardCell.execution_count = executionCount ?? null;
    standardCell.outputs = (output || []).map((item: OutputItem) => {
      // Map internal output types to standard NBFormat types
      if (item.type === 'stdout' || item.type === 'stderr') {
        return {
          output_type: 'stream',
          name: item.type,
          text: item.content.split('\n').map((l: string, i: number, a: string[]) => i === a.length - 1 ? l : l + '\n')
        };
      } else if (item.type === 'html') {
        return {
          output_type: 'display_data',
          data: {
            'text/html': item.content
          },
          metadata: {}
        };
      } else if (item.type === 'img') {
        // Strip data URI prefix if present to get raw base64
        const base64Data = item.content.replace(/^data:image\/[a-z]+;base64,/, '');
        // Default to png if we can't infer, but usually it's png or jpeg
        const mimeType = item.content.includes('image/jpeg') ? 'image/jpeg' : 'image/png';
        return {
          output_type: 'display_data',
          data: {
            [mimeType]: base64Data
          },
          metadata: {}
        };
      } else if (item.type === 'result') {
        return {
          output_type: 'execute_result',
          execution_count: executionCount ?? null,
          data: {
            'text/plain': item.content
          },
          metadata: {}
        };
      } else if (item.type === 'error') {
        return {
          output_type: 'error',
          ename: 'Error',
          evalue: item.content,
          traceback: [item.content]
        };
      }
      // Fallback for unknown types - keep as is (might not be visible but preserves data)
      return item;
    });
  }

  return standardCell;
};

// Helper to convert standard notebook format to internal cell format
const fromStandardCell = (cell: any): NotebookCell => {
  // Check if it's already in internal format (legacy support)
  if (cell.type && !cell.cell_type && cell.content !== undefined) {
    return cell as NotebookCell;
  }
  
  // Standard format conversion
  let content = '';
  if (Array.isArray(cell.source)) {
    content = cell.source.join('');
  } else if (typeof cell.source === 'string') {
    content = cell.source;
  } else if (cell.content) {
      content = cell.content;
  }
  
  const outputs: OutputItem[] = [];
  if (cell.outputs && Array.isArray(cell.outputs)) {
    cell.outputs.forEach((output: any) => {
      if (output.output_type === 'stream') {
        outputs.push({
          type: output.name, // stdout or stderr
          content: Array.isArray(output.text) ? output.text.join('') : output.text,
          short_content: (Array.isArray(output.text) ? output.text.join('') : output.text).substring(0, 100)
        });
      } else if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
        if (output.data['text/html']) {
          outputs.push({
            type: 'html',
            content: output.data['text/html'],
            short_content: '[HTML]'
          });
        }
        if (output.data['image/png']) {
          outputs.push({
            type: 'img',
            content: `data:image/png;base64,${output.data['image/png']}`,
            short_content: '[Image]'
          });
        } else if (output.data['image/jpeg']) {
          outputs.push({
            type: 'img',
            content: `data:image/jpeg;base64,${output.data['image/jpeg']}`,
            short_content: '[Image]'
          });
        }
        
        // Convert unknown MIME types or text/plain if no rich media found
        if (!output.data['text/html'] && !output.data['image/png'] && !output.data['image/jpeg'] && output.data['text/plain']) {
           const type = output.output_type === 'execute_result' ? 'result' : 'stdout';
           outputs.push({
             type: type,
             content: output.data['text/plain'],
             short_content: output.data['text/plain'].substring(0, 100)
           });
        }
      } else if (output.output_type === 'error') {
        const errorContent = output.traceback ? output.traceback.join('\n') : `${output.ename}: ${output.evalue}`;
        outputs.push({
          type: 'error',
          content: errorContent,
          short_content: `${output.ename}: ${output.evalue}`
        });
      }
    });
  } else if (cell.output) {
      // Legacy support for cells already having 'output' property in internal format
      outputs.push(...cell.output);
  }
  
  return {
    id: cell.id || uuidv4(),
    type: (cell.cell_type || cell.type || 'code') as any,
    content: content,
    language: cell.language,
    executionCount: cell.execution_count ?? cell.executionCount,
    executionState: cell.executionState || 'idle',
    output: outputs,
    role: cell.metadata?.role || cell.role,
    metadata: cell.metadata || {}
  };
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
        cells: cellManager.getCurrentCellsContent().map(toStandardCell) as any
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
          const errorMsg = 'Projects are still loading, please try again shortly.';
          console.warn('[Notebook] Load file cancelled: Projects provider not ready for remote project.', resolvedProjectId);
          showToast(errorMsg, 'warning', { id: loadingToastId });
          throw new Error(errorMsg); // Throw error instead of silently returning
        }
        rawContent = await getFileContent(resolvedProjectId, filePath);
      }

      // Validate content exists
      if (!rawContent) {
        throw new Error('File content is empty or could not be loaded');
      }

      const notebookData: NotebookData = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

      if (notebookData && typeof notebookData === 'object') {
        const rawCells = notebookData.cells || [];
        const loadedCells = rawCells.map(fromStandardCell);

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

        const visibleCells = loadedCells.filter(cell => cell.role !== CELL_ROLES.THINKING);
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

    const loadingToastId = 'loading-file-from-disk';
    showToast('Reading file...', 'loading', { id: loadingToastId });

    const reader = new FileReader();

    reader.onerror = () => {
      showToast('Failed to read file. Please try again.', 'error', { id: loadingToastId });
      event.target.value = '';
    };

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;

        // Validate content exists
        if (!content || content.trim() === '') {
          throw new Error('File is empty or unreadable');
        }

        showToast('Parsing notebook...', 'loading', { id: loadingToastId });

        // Parse JSON with better error handling
        let loadedNotebookData: NotebookData;
        try {
          loadedNotebookData = JSON.parse(content);
        } catch (parseError) {
          throw new Error('Invalid notebook file format. Please ensure this is a valid .ipynb file.');
        }

        // Validate notebook structure
        if (!loadedNotebookData || typeof loadedNotebookData !== 'object') {
          throw new Error('Invalid notebook structure');
        }

        if (!Array.isArray(loadedNotebookData.cells)) {
          throw new Error('Notebook is missing cells array');
        }

        showToast('Loading notebook...', 'loading', { id: loadingToastId });

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

        const rawCells = loadedNotebookData.cells || [];
        const cellsToLoad = rawCells.map(fromStandardCell).filter(cell => cell.role !== CELL_ROLES.THINKING);

        // Calculate max execution count
        let maxExecutionCount = 0;
        cellsToLoad.forEach((cell: NotebookCell) => {
          const count = cell.executionCount;
          if (typeof count === 'number' && isFinite(count) && count > maxExecutionCount) {
            maxExecutionCount = count;
          }
        });

        // Save to in-browser storage first
        const notebookToSave: NotebookData = {
          nbformat: 4,
          nbformat_minor: 5,
          metadata: metadata,
          cells: cellsToLoad.map(toStandardCell) as any
        };

        try {
          await saveInBrowserFile(newFilePath, notebookToSave);
          console.log(`[NotebookOps] Saved uploaded file to in-browser: ${newFilePath}`);
        } catch (saveError) {
          throw new Error(`Failed to save notebook: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
        }

        // Update all state in sequence
        setSelectedProject(getInBrowserProject());
        setNotebookMetadata(metadata);
        setCells(cellsToLoad);
        setExecutionCounter(maxExecutionCount + 1);
        lastUserCellRef.current = null;
        lastAgentCellRef.current = null;

        // Wait a tick for state to settle
        await new Promise(resolve => setTimeout(resolve, 0));

        // Reset kernel state
        showToast('Initializing kernel...', 'loading', { id: loadingToastId });
        await resetKernelState();

        showToast('Notebook loaded successfully', 'success', { id: loadingToastId });

      } catch (error) {
        console.error('[NotebookOps] Error loading notebook from file:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        showToast(`Failed to load notebook: ${errorMessage}`, 'error', { id: loadingToastId });

        // Reset state on error
        setCells([]);
        setNotebookMetadata(defaultNotebookMetadata);
        setExecutionCounter(1);
        lastUserCellRef.current = null;
        lastAgentCellRef.current = null;
      } finally {
        // Always clear the file input to allow re-uploading the same file
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
      cells: (cellManager?.getCurrentCellsContent() || []).map(toStandardCell) as any,
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

      let internalCells: NotebookCell[] = [];
      const template = agent.manifest.chat_template || {};

      if (template.cells && template.cells.length > 0) {
        console.log('[Notebook] Using cells from agent chat template');
        internalCells = template.cells.map(fromStandardCell);
      } else if (agent.manifest.startup_script) {
        console.log('[Notebook] Creating system cell with agent startup script');
        const systemCellContent = agent.manifest.startup_script;
        internalCells.push({
          id: uuidv4(),
          type: 'code',
          content: systemCellContent,
          executionState: 'idle',
          role: 'system',
          metadata: {
            trusted: true
          },
          executionCount: undefined,
          output: []
        });

        if (agent.manifest.welcomeMessage) {
          console.log('[Notebook] Adding welcome message cell');
          internalCells.push({
            id: uuidv4(),
            type: 'markdown',
            content: agent.manifest.welcomeMessage,
            executionState: 'idle',
            role: 'assistant',
            metadata: {
              trusted: true
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
        cells: internalCells.map(toStandardCell) as any
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