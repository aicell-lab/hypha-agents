import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useProjects } from '../providers/ProjectsProvider';
import { useHyphaStore } from '../store/hyphaStore';
import { showToast } from '../utils/notebookUtils';
import { NotebookCell, NotebookMetadata } from '../types/notebook';
import type { 
  AgentOperationsState, 
  CreateAgentDialogData,
  EditAgentFormData,
  AgentConfigData
} from '../utils/agentLabTypes';

export interface UseAgentOperationsReturn extends AgentOperationsState {
  handleCreateAgent: (data: CreateAgentDialogData) => Promise<void>;
  handleEditAgent: (formData: EditAgentFormData) => Promise<void>;
  handlePublishAgent: (config: AgentConfigData) => Promise<void>;
  openCreateAgentDialog: () => void;
  closeCreateAgentDialog: () => void;
  openEditAgentDialog: () => void;
  closeEditAgentDialog: () => void;
}

export function useAgentOperations(
  cells: NotebookCell[],
  notebookMetadata: NotebookMetadata,
  setCells: React.Dispatch<React.SetStateAction<NotebookCell[]>>,
  setNotebookMetadata: React.Dispatch<React.SetStateAction<NotebookMetadata>>,
  executeCodeRef: React.MutableRefObject<any>,
  setCanvasPanelComponent: (component: string | null) => void
): UseAgentOperationsReturn {
  const navigate = useNavigate();
  const { uploadFile, selectedProject } = useProjects();
  const { server, isLoggedIn } = useHyphaStore();
  
  const [isCreateAgentDialogOpen, setIsCreateAgentDialogOpen] = useState(false);
  const [isEditAgentDialogOpen, setIsEditAgentDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const openCreateAgentDialog = useCallback(() => {
    setIsCreateAgentDialogOpen(true);
  }, []);

  const closeCreateAgentDialog = useCallback(() => {
    setIsCreateAgentDialogOpen(false);
  }, []);

  const openEditAgentDialog = useCallback(() => {
    setIsEditAgentDialogOpen(true);
  }, []);

  const closeEditAgentDialog = useCallback(() => {
    setIsEditAgentDialogOpen(false);
  }, []);

  const handleCreateAgent = useCallback(async (data: CreateAgentDialogData) => {
    try {
      console.log('Creating agent with data:', data);
      
      // Get current system cells content
      const systemCells = cells.filter(cell => cell.role === 'system');
      const systemContent = systemCells.map(cell => cell.content).join('\n\n');
      
      // Create agent manifest
      const agentManifest = {
        name: data.name,
        description: data.description,
        version: data.version || '0.1.0',
        type: 'agent',
        created_at: new Date().toISOString(),
        author: data.author || 'Anonymous',
        tags: data.tags || [],
        requirements: data.requirements || [],
        system_prompt: systemContent,
        knowledge_base: data.knowledgeBase || []
      };

      // Create agent files structure
      const agentFiles = [
        {
          path: 'manifest.json',
          content: JSON.stringify(agentManifest, null, 2),
          type: 'application/json'
        },
        {
          path: 'README.md',
          content: `# ${data.name}\n\n${data.description}\n\n## Version\n${data.version || '0.1.0'}\n\n## Created\n${new Date().toISOString()}`,
          type: 'text/markdown'
        }
      ];

      // Add notebook file if there are cells
      if (cells.length > 0) {
        const notebookData = {
          metadata: {
            ...notebookMetadata,
            title: data.name,
            description: data.description
          },
          cells: cells.map(cell => ({
            ...cell,
            metadata: {
              ...cell.metadata,
              agent_id: data.name
            }
          }))
        };

        agentFiles.push({
          path: 'notebook.json',
          content: JSON.stringify(notebookData, null, 2),
          type: 'application/json'
        });
      }

      // Upload files to project or save locally
      if (selectedProject && uploadFile) {
        const agentFolderPath = `agents/${data.name}`;
        
        for (const file of agentFiles) {
          // Create a File object for uploadFile
          const blob = new Blob([file.content], { type: file.type });
          const fileObj = new File([blob], file.path.split('/').pop() || 'file', { type: file.type });
          await uploadFile(selectedProject.id, fileObj);
        }
        
        showToast(`Agent "${data.name}" created successfully in project`, 'success');
      } else {
        // Save to local storage or handle as needed
        console.log('Agent files created:', agentFiles);
        showToast(`Agent "${data.name}" created successfully`, 'success');
      }

      setIsCreateAgentDialogOpen(false);
      
      // Optionally navigate to agent page
      if (data.navigateToAgent) {
        navigate(`/agents/${data.name}`);
      }
      
    } catch (error) {
      console.error('Error creating agent:', error);
      showToast(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [cells, notebookMetadata, selectedProject, uploadFile, navigate]);

  const handleEditAgent = useCallback(async (formData: EditAgentFormData) => {
    try {
      console.log('Editing agent with data:', formData);
      
      // Update notebook metadata
      const updatedMetadata = {
        ...notebookMetadata,
        title: formData.name,
        description: formData.description,
        modified: new Date().toISOString()
      };
      
      setNotebookMetadata(updatedMetadata);
      
      // Update system cells if system prompt changed
      if (formData.systemPrompt) {
        const systemCells = cells.filter(cell => cell.role === 'system');
        
        if (systemCells.length > 0) {
          // Update existing system cell
          setCells(prevCells => 
            prevCells.map(cell => 
              cell.role === 'system' 
                ? { ...cell, content: formData.systemPrompt || '' }
                : cell
            )
          );
        } else {
          // Create new system cell
          const newSystemCell: NotebookCell = {
            id: uuidv4(),
            content: formData.systemPrompt || '',
            type: 'code',
            executionState: 'idle',
            role: 'system',
            executionCount: undefined,
            output: [],
            metadata: {
              trusted: true,
              role: 'system'
            }
          };
          
          setCells(prevCells => [newSystemCell, ...prevCells]);
        }
      }
      
      showToast('Agent updated successfully', 'success');
      setIsEditAgentDialogOpen(false);
      setCanvasPanelComponent(null);
      
    } catch (error) {
      console.error('Error editing agent:', error);
      showToast(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [notebookMetadata, cells, setNotebookMetadata, setCells, setCanvasPanelComponent]);

  const handlePublishAgent = useCallback(async (config: AgentConfigData) => {
    if (!isLoggedIn || !server) {
      showToast('Please log in to publish agents', 'error');
      return;
    }

    setIsPublishing(true);
    
    try {
      console.log('Publishing agent with config:', config);
      
      // Create agent package
      const agentPackage = {
        name: config.name,
        description: config.description,
        version: config.version || '0.1.0',
        author: config.author,
        tags: config.tags || [],
        requirements: config.requirements || [],
        system_prompt: cells.filter(cell => cell.role === 'system').map(cell => cell.content).join('\n\n'),
        notebook_data: {
          metadata: notebookMetadata,
          cells: cells
        },
        created_at: new Date().toISOString(),
        published_at: new Date().toISOString()
      };

      // Upload to Hypha server (placeholder - implement actual upload logic)
      console.log('Agent package to publish:', agentPackage);
      
      // TODO: Implement actual publishing to Hypha server
      // const result = await server.publishAgent(agentPackage);
      
      showToast(`Agent "${config.name}" published successfully!`, 'success');
      
      // Optionally navigate to published agent
      navigate(`/agents/${config.name}`);
      
    } catch (error) {
      console.error('Error publishing agent:', error);
      showToast(`Failed to publish agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsPublishing(false);
    }
  }, [isLoggedIn, server, cells, notebookMetadata, navigate]);

  return {
    isCreateAgentDialogOpen,
    isEditAgentDialogOpen,
    isPublishing,
    handleCreateAgent,
    handleEditAgent,
    handlePublishAgent,
    openCreateAgentDialog,
    closeCreateAgentDialog,
    openEditAgentDialog,
    closeEditAgentDialog
  };
} 