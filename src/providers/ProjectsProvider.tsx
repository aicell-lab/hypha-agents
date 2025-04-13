import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useHyphaStore } from '../store/hyphaStore';
import { Dialog } from '@headlessui/react';
import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'agent_lab_projects',
  storeName: 'agent_lab_projects',
  description: 'Storage for agent lab projects'
});

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
  isInBrowser?: boolean;  // New flag to identify InBrowserProject
}

export interface ProjectFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
  created_at?: string;
  modified_at?: string;
  size?: number;
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
  // New methods for InBrowserProject
  getInBrowserProject: () => Project;
  saveInBrowserFile: (filePath: string, content: any) => Promise<void>;
  listInBrowserFiles: () => Promise<ProjectFile[]>;
  deleteInBrowserFile: (filePath: string) => Promise<void>;
  getInBrowserFileContent: (filePath: string) => Promise<any>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

// Create a constant for InBrowserProject
export const IN_BROWSER_PROJECT: Project = {
  id: 'in-browser',
  manifest: {
    name: 'In-Browser Project',
    description: 'Local files stored in your browser',
    version: '1.0.0',
    type: 'local',
    created_at: new Date().toISOString()
  },
  isInBrowser: true
};

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

  // Log initial values from store
  console.log('[ProjectsProvider Mount/Render] Initial values:', {
    hasArtifactManager: !!artifactManager,
    userId: user?.id
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // New methods for InBrowserProject (define these first)
  const saveInBrowserFile = useCallback(async (filePath: string, content: any) => {
    try {
      console.info('[ProjectsProvider] Saving in-browser file:', filePath);
      await localforage.setItem(`InBrowserProject/${filePath}`, content);
      console.info('[ProjectsProvider] File saved successfully:', filePath);
    } catch (err) {
      console.error('[ProjectsProvider] Error saving in-browser file:', err);
      throw new Error('Failed to save in-browser file');
    }
  }, []); // No external dependencies needed here

  const listInBrowserFiles = useCallback(async (): Promise<ProjectFile[]> => {
    try {
      console.info('[ProjectsProvider] Listing in-browser files');
      const files: ProjectFile[] = [];
      await localforage.iterate((value, key) => {
        if (key.startsWith('InBrowserProject/')) {
          const path = key.replace('InBrowserProject/', '');
          const name = path.split('/').pop() || path;
          files.push({
            name,
            path,
            type: 'file',
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            size: 0
          });
        }
      });
      console.info('[ProjectsProvider] Found in-browser files:', files.length);
      return files;
    } catch (err) {
      console.error('[ProjectsProvider] Error listing in-browser files:', err);
      return [];
    }
  }, []); // No external dependencies needed here

  const deleteInBrowserFile = useCallback(async (filePath: string) => {
    try {
      console.info('[ProjectsProvider] Deleting in-browser file:', filePath);
      await localforage.removeItem(`InBrowserProject/${filePath}`);
      console.info('[ProjectsProvider] File deleted successfully:', filePath);
    } catch (err) {
      console.error('[ProjectsProvider] Error deleting in-browser file:', err);
      throw new Error('Failed to delete in-browser file');
    }
  }, []); // No external dependencies needed here

  const getInBrowserFileContent = useCallback(async (filePath: string): Promise<any> => {
    try {
      console.info('[ProjectsProvider] Getting in-browser file content:', filePath);
      const content = await localforage.getItem(`InBrowserProject/${filePath}`);
      if (content === null) {
        throw new Error('File not found');
      }
      return content;
    } catch (err) {
      console.error('[ProjectsProvider] Error getting in-browser file content:', err);
      throw new Error('Failed to get in-browser file content');
    }
  }, []); // No external dependencies needed here

  // Ensure projects collection exists
  const ensureProjectsCollection = useCallback(async () => {
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
  }, [artifactManager, user]);

  // Fetch all projects
  const refreshProjects = useCallback(async () => {
    // Log values at the start of refresh
    console.log('[ProjectsProvider refreshProjects Start] Values:', {
      hasArtifactManager: !!artifactManager,
      userId: user?.id
    });
    if (!artifactManager || !user) {
      const errorMsg = 'Cannot refresh projects: Artifact manager or user not available.';
      console.error(`[ProjectsProvider] ${errorMsg}`);
      setError(errorMsg);
      setIsLoading(false);
      setProjects([]); // Keep projects empty
      throw new Error(errorMsg);
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
      // Set only the fetched remote projects
      setProjects(projectsList); 
    } catch (err) {
      console.error('[ProjectsProvider] Error fetching projects:', err);
      setError('Failed to load projects');
      // Set empty array on error
      setProjects([]); 
    } finally {
      setIsLoading(false);
    }
  }, [artifactManager, user, ensureProjectsCollection]);

  // Create a new project
  const createProject = useCallback(async (name: string, description: string): Promise<Project> => {
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
  }, [artifactManager, user, refreshProjects]);

  // Delete a project
  const deleteProject = useCallback(async (projectId: string) => {
    if (!artifactManager || !user) {
      const errorMsg = 'Cannot delete project: Artifact manager or user not available.';
      console.error(`[ProjectsProvider] ${errorMsg}`);
      setError(errorMsg);
      throw new Error(errorMsg);
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
  }, [artifactManager, user, selectedProject, refreshProjects]);

  // Get project files
  const getProjectFiles = useCallback(async (projectId: string): Promise<ProjectFile[]> => {
    // Log values at the start
    console.log('[ProjectsProvider getProjectFiles Start] Values:', {
        projectId,
        hasArtifactManager: !!artifactManager,
        userId: user?.id
    });
    if (projectId === 'in-browser') {
      return listInBrowserFiles();
    }

    if (!artifactManager || !user) {
      const errorMsg = 'Cannot get project files: Artifact manager or user not available.';
      console.error(`[ProjectsProvider] ${errorMsg}`);
      throw new Error(errorMsg);
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
        type: file.type,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        size: 0
      }));

      console.info('[ProjectsProvider] Fetched files:', files.length);
      return files;
    } catch (err) {
      console.error('[ProjectsProvider] Error fetching project files:', err);
      throw new Error('Failed to fetch project files');
    }
  }, [artifactManager, user, listInBrowserFiles]);

  // Upload a file to a project
  const uploadFile = useCallback(async (projectId: string, file: File) => {
    // Log values at the start
    console.log('[ProjectsProvider uploadFile Start] Values:', {
        projectId,
        fileName: file.name,
        hasArtifactManager: !!artifactManager,
        userId: user?.id
    });
    if (projectId === 'in-browser') {
      try {
        const content = await file.text();
        // Try to parse as JSON if it's a notebook file
        const fileContent = file.name.endsWith('.ipynb') ? JSON.parse(content) : content;
        await saveInBrowserFile(file.name, fileContent);
        return;
      } catch (err) {
        console.error('[ProjectsProvider] Error uploading in-browser file:', err);
        throw new Error('Failed to upload in-browser file');
      }
    }

    if (!artifactManager || !user) {
      const errorMsg = 'Cannot upload file: Artifact manager or user not available.';
      console.error(`[ProjectsProvider] ${errorMsg}`);
      throw new Error(errorMsg);
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
  }, [artifactManager, user, saveInBrowserFile]);

  // Delete a file from a project
  const deleteFile = useCallback(async (projectId: string, filePath: string) => {
    // Log values at the start
    console.log('[ProjectsProvider deleteFile Start] Values:', {
        projectId,
        filePath,
        hasArtifactManager: !!artifactManager,
        userId: user?.id
    });
    if (projectId === 'in-browser') {
      await deleteInBrowserFile(filePath);
      return;
    }

    if (!artifactManager || !user) {
      const errorMsg = 'Cannot delete file: Artifact manager or user not available.';
      console.error(`[ProjectsProvider] ${errorMsg}`);
      throw new Error(errorMsg);
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
  }, [artifactManager, user, deleteInBrowserFile]);

  // Get file content
  const getFileContent = useCallback(async (projectId: string, filePath: string): Promise<string> => {
    // Log values at the start - CRITICAL POINT
    console.log('[ProjectsProvider getFileContent Start] Values:', {
        projectId,
        filePath,
        hasArtifactManager: !!artifactManager,
        userId: user?.id
    });

    if (projectId === 'in-browser') {
      const content = await getInBrowserFileContent(filePath);
      return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    }

    if (!artifactManager || !user) {
      const errorMsg = 'Cannot get file content: Artifact manager or user not available.';
      // Log right before throwing
      console.error(`[ProjectsProvider getFileContent Check FAILED] ${errorMsg}`, {
        hasArtifactManager: !!artifactManager,
        userId: user?.id
       });
      throw new Error(errorMsg);
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
  }, [artifactManager, user, getInBrowserFileContent]);

  // Define getInBrowserProject here if needed (it has no dependencies)
  const getInBrowserProject = () => IN_BROWSER_PROJECT;

  // Load projects on mount
  useEffect(() => {
    // Log values when this effect runs
    console.log('[ProjectsProvider Initial Load Effect] Running effect. Values:', {
      hasArtifactManager: !!artifactManager,
      userId: user?.id
    });
    if (artifactManager && user) {
      console.info('[ProjectsProvider] Initial projects load triggered.');
      refreshProjects();
    } else {
      console.warn('[ProjectsProvider] Skipping initial projects load - no artifactManager or user.');
    }
  }, [artifactManager, user, refreshProjects]);

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
    closeCreateDialog: () => setShowCreateDialog(false),
    // Add new methods to context
    getInBrowserProject,
    saveInBrowserFile,
    listInBrowserFiles,
    deleteInBrowserFile,
    getInBrowserFileContent
  };

  return (
    <ProjectsContext.Provider value={value}>
      {children}
      <CreateProjectDialog />
    </ProjectsContext.Provider>
  );
}; 