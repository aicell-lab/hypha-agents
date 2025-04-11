import React, { createContext, useContext, useState, useEffect } from 'react';
import { useHyphaStore } from '../store/hyphaStore';
import { Dialog } from '@headlessui/react';

export interface Project {
  id: string;
  manifest: {
    name: string;
    description: string;
    version: string;
    type: string;
    created_at: string;
  };
  files?: ProjectFile[];
}

export interface ProjectFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
}

interface ProjectsContextType {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  isLoading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  getProjectFiles: (projectId: string) => Promise<ProjectFile[]>;
  uploadFile: (projectId: string, file: File) => Promise<void>;
  deleteFile: (projectId: string, filePath: string) => Promise<void>;
  getFileContent: (projectId: string, filePath: string) => Promise<string>;
  showCreateDialog: boolean;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export const useProjects = () => {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};

const CreateProjectDialog: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { createProject, showCreateDialog, closeCreateDialog } = useProjects();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProject(name, description);
      closeCreateDialog();
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  return (
    <Dialog open={showCreateDialog} onClose={closeCreateDialog} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-6">
          <Dialog.Title className="text-lg font-medium mb-4">Create New Project</Dialog.Title>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="project-name">
                Project Name
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                placeholder="Enter project name"
                title="Project name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="project-description">
                Description
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={3}
                placeholder="Enter project description"
                title="Project description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateDialog}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export const ProjectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { artifactManager, user } = useHyphaStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Ensure projects collection exists
  const ensureProjectsCollection = async () => {
    if (!artifactManager || !user) {
      console.warn('[ProjectsProvider] No artifactManager or user available');
      return;
    }

    try {
      console.info('[ProjectsProvider] Checking for projects collection...');
      // Try to read the collection
      await artifactManager.read({
        artifact_id: 'agent-lab-projects',
        _rkwargs: true
      });
      console.info('[ProjectsProvider] Projects collection exists');
    } catch (error) {
      console.warn('[ProjectsProvider] Projects collection not found, creating...');
      // Collection doesn't exist, create it
      try {
        const collection = await artifactManager.create({
          alias: 'agent-lab-projects',
          type: "collection",
          manifest: {
            name: "Agent Lab Projects",
            description: "Collection of Agent Lab projects",
            version: "1.0.0",
            type: "collection"
          },
          config: {
            permissions: {"*": "r", "@": "r+"},
          },
          _rkwargs: true
        });
        console.info('[ProjectsProvider] Created projects collection:', collection);
      } catch (createError) {
        console.error('[ProjectsProvider] Failed to create projects collection:', createError);
        throw createError;
      }
    }
  };

  // Fetch all projects
  const refreshProjects = async () => {
    if (!artifactManager || !user) {
      console.warn('[ProjectsProvider] Cannot refresh projects - no artifactManager or user');
      return;
    }

    try {
      console.info('[ProjectsProvider] Refreshing projects list...');
      setIsLoading(true);
      setError(null);

      await ensureProjectsCollection();

      const projectsList = await artifactManager.list({
        parent_id: 'agent-lab-projects',
        filters: {
            "version": "stage"
        },
        _rkwargs: true
      });

      console.info('[ProjectsProvider] Fetched projects:', projectsList.length);
      setProjects(projectsList);
    } catch (err) {
      console.error('[ProjectsProvider] Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new project
  const createProject = async (name: string, description: string): Promise<Project> => {
    if (!artifactManager || !user) {
      console.error('[ProjectsProvider] Cannot create project - no artifactManager or user');
      throw new Error('Not authenticated');
    }

    try {
      console.info('[ProjectsProvider] Creating new project:', { name, description });
      setIsLoading(true);
      setError(null);

      const project = await artifactManager.create({
        parent_id: 'agent-lab-projects',
        type: "project",
        manifest: {
          name,
          description,
          version: "1.0.0",
          created_at: new Date().toISOString()
        },
        _rkwargs: true
      });

      console.info('[ProjectsProvider] Created project:', project.id);
      await refreshProjects();
      return project;
    } catch (err) {
      console.error('[ProjectsProvider] Error creating project:', err);
      throw new Error('Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a project
  const deleteProject = async (projectId: string) => {
    if (!artifactManager || !user) {
      console.warn('[ProjectsProvider] Cannot delete project - no artifactManager or user');
      return;
    }

    try {
      console.info('[ProjectsProvider] Deleting project:', projectId);
      setIsLoading(true);
      setError(null);

      await artifactManager.delete({
        artifact_id: projectId,
        delete_files: true,
        recursive: true,
        _rkwargs: true
      });

      if (selectedProject?.id === projectId) {
        console.info('[ProjectsProvider] Clearing selected project as it was deleted');
        setSelectedProject(null);
      }

      console.info('[ProjectsProvider] Project deleted successfully:', projectId);
      await refreshProjects();
    } catch (err) {
      console.error('[ProjectsProvider] Error deleting project:', err);
      throw new Error('Failed to delete project');
    } finally {
      setIsLoading(false);
    }
  };

  // Get project files
  const getProjectFiles = async (projectId: string): Promise<ProjectFile[]> => {
    if (!artifactManager || !user) {
      console.warn('[ProjectsProvider] Cannot get project files - no artifactManager or user');
      return [];
    }

    try {
      console.info('[ProjectsProvider] Fetching files for project:', projectId);
      const fileList = await artifactManager.list_files({
        artifact_id: projectId,
        version: 'stage',
        _rkwargs: true
      });

      const files = fileList.map((file: any) => ({
        name: file.name,
        path: file.name,
        type: file.type
      }));

      console.info('[ProjectsProvider] Fetched files:', files.length);
      return files;
    } catch (err) {
      console.error('[ProjectsProvider] Error fetching project files:', err);
      throw new Error('Failed to fetch project files');
    }
  };

  // Upload a file to a project
  const uploadFile = async (projectId: string, file: File) => {
    if (!artifactManager || !user) {
      console.warn('[ProjectsProvider] Cannot upload file - no artifactManager or user');
      return;
    }

    try {
      console.info('[ProjectsProvider] Uploading file:', { projectId, fileName: file.name });
      const presignedUrl = await artifactManager.put_file({
        artifact_id: projectId,
        file_path: file.name,
        _rkwargs: true
      });

      console.info('[ProjectsProvider] Got presigned URL for upload');
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': '' // important for s3
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      console.info('[ProjectsProvider] File uploaded successfully:', file.name);
    } catch (err) {
      console.error('[ProjectsProvider] Error uploading file:', err);
      throw new Error('Failed to upload file');
    }
  };

  // Delete a file from a project
  const deleteFile = async (projectId: string, filePath: string) => {
    if (!artifactManager || !user) {
      console.warn('[ProjectsProvider] Cannot delete file - no artifactManager or user');
      return;
    }

    try {
      console.info('[ProjectsProvider] Deleting file:', { projectId, filePath });
      await artifactManager.remove_file({
        artifact_id: projectId,
        file_path: filePath,
        _rkwargs: true
      });
      console.info('[ProjectsProvider] File deleted successfully:', filePath);
    } catch (err) {
      console.error('[ProjectsProvider] Error deleting file:', err);
      throw new Error('Failed to delete file');
    }
  };

  // Get file content
  const getFileContent = async (projectId: string, filePath: string): Promise<string> => {
    if (!artifactManager || !user) {
      console.warn('[ProjectsProvider] Cannot get file content - no artifactManager or user');
      return '';
    }

    try {
      console.info('[ProjectsProvider] Fetching file content:', { projectId, filePath });
      const url = await artifactManager.get_file({
        artifact_id: projectId,
        file_path: filePath,
        version: 'stage',
        _rkwargs: true
      });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
      }

      const content = await response.text();
      console.info('[ProjectsProvider] File content fetched successfully:', filePath);
      return content;
    } catch (err) {
      console.error('[ProjectsProvider] Error fetching file content:', err);
      throw new Error('Failed to fetch file content');
    }
  };

  // Load projects on mount
  useEffect(() => {
    if (artifactManager && user) {
      console.info('[ProjectsProvider] Initial projects load');
      refreshProjects();
    } else {
      console.warn('[ProjectsProvider] Skipping initial projects load - no artifactManager or user');
    }
  }, [artifactManager, user]);

  // Log state changes in debug mode
  useEffect(() => {
    console.info('[ProjectsProvider] State updated:', {
      projectsCount: projects.length,
      selectedProject: selectedProject?.id,
      isLoading,
      error
    });
  }, [projects, selectedProject, isLoading, error]);

  const value = {
    projects,
    selectedProject,
    setSelectedProject,
    isLoading,
    error,
    refreshProjects,
    createProject,
    deleteProject,
    getProjectFiles,
    uploadFile,
    deleteFile,
    getFileContent,
    showCreateDialog,
    openCreateDialog: () => setShowCreateDialog(true),
    closeCreateDialog: () => setShowCreateDialog(false)
  };

  return (
    <ProjectsContext.Provider value={value}>
      {children}
      <CreateProjectDialog />
    </ProjectsContext.Provider>
  );
}; 