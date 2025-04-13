import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { FaBook, FaCode, FaFolder, FaSync, FaPlus, FaFile, FaTrash, FaLaptop, FaChevronDown, FaUpload, FaComment } from 'react-icons/fa';
import { useProjects, ProjectFile, IN_BROWSER_PROJECT, Project } from '../../providers/ProjectsProvider';
import ProjectFileTree from './ProjectFileTree';
import { useDropzone } from 'react-dropzone';
import { useHyphaStore } from '../../store/hyphaStore';
import ConfirmDialog from '../common/ConfirmDialog';
import { CellManager } from '../../pages/CellManager';
import localforage from 'localforage';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onResize?: (width: number) => void;
  onLoadNotebook: (project: Project, file: ProjectFile) => void;
}

// Add upload status type
interface UploadStatus {
  message: string;
  severity: 'info' | 'success' | 'error';
  progress?: number;
}

// Add new interfaces for dropdown menu
interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

// Update ProjectFile interface to include id
interface ExtendedProjectFile extends ProjectFile {
  id: string;
  created_at: string;
  modified_at: string;
  size: number;
}

const Dropdown: React.FC<DropdownProps> = ({ isOpen, onClose, children, className }) => {
  if (!isOpen) return null;

  return (
    <div 
      className={`absolute right-0 mt-2 py-2 w-48 bg-white rounded-md shadow-xl z-20 border border-gray-200 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onResize,
  onLoadNotebook
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const { artifactManager, isLoggedIn } = useHyphaStore();
  const { 
    projects, 
    refreshProjects, 
    selectedProject, 
    setSelectedProject, 
    getProjectFiles,
    openCreateDialog,
    uploadFile,
    deleteProject,
    listInBrowserFiles,
    saveInBrowserFile,
    getInBrowserProject
  } = useProjects();
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
  const [inBrowserFiles, setInBrowserFiles] = useState<ProjectFile[]>([]);
  const [selectedInBrowserFile, setSelectedInBrowserFile] = useState<string | null>(null);
  const [isInBrowserProject, setIsInBrowserProject] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addButtonRef = useRef<HTMLDivElement>(null);
  // isLoadingFiles: Tracks the loading state for fetching remote project files.
  // This prevents the file tree from rendering with potentially stale data
  // while asynchronous file fetching is in progress.
  // NOW: Also used for loading in-browser files.
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Log the received prop on render
  // console.log("[Sidebar Render] Type of onLoadNotebook prop:", typeof onLoadNotebook, onLoadNotebook); // Removed render log

  // Load project files when a project is selected
  useEffect(() => {
    const loadProjectFiles = async () => {
      // --- GUARD: Only run for remote projects --- 
      if (!selectedProject || selectedProject.id === IN_BROWSER_PROJECT.id) {
        // Clear remote files if switching to in-browser or no selection
        if (projectFiles.length > 0) setProjectFiles([]);
        return;
      }
      // --- End GUARD ---

      const fetchFiles = async () => {
        try {
          console.info('[Sidebar] Loading files for project:', selectedProject.id); // Keep info
          // console.log(`[Sidebar Debug] Calling getProjectFiles for ID: ${selectedProject.id}`); // Removed debug
          setIsLoadingFiles(true); // Set loading true before fetch
          const files = await getProjectFiles(selectedProject.id);
          // console.log('[Sidebar Debug] Fetched files:', files); // Removed debug
          console.info('[Sidebar] Loaded files:', files.length); // Keep info
          setProjectFiles(prevFiles => {
            // console.log('[Sidebar Debug] Updating projectFiles state. Previous:', prevFiles, 'New:', files); // Removed debug
            return files;
          });
        } catch (error) {
          console.error('Error loading project files:', error); // Keep error
          // console.log('[Sidebar Debug] Error loading project files:', error); // Removed debug
          setProjectFiles([]); // Clear files on error
        } finally {
          setIsLoadingFiles(false); // Set loading false after fetch/error
        }
      };

      fetchFiles(); // Call the async function
    };

    loadProjectFiles();
  }, [selectedProject, getProjectFiles]);

  // Detect mobile screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addButtonRef.current && !addButtonRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle project selection
  const handleProjectClick = async (projectId: string) => {
    if (projectId === 'in-browser') {
      setIsInBrowserProject(true);
      const inBrowserProject = getInBrowserProject(); 
      setSelectedProject(inBrowserProject);
      setSelectedInBrowserFile(null);
      // --- Trigger loading --- 
      setIsLoadingFiles(true);
      try {
        const files = await listInBrowserFiles();
        setInBrowserFiles(files.map(f => ({
          ...f,
          id: f.path,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          size: 0
        })));
      } catch (error) {
        console.error("Failed to load in-browser files on click:", error);
        setInBrowserFiles([]);
      } finally {
        setIsLoadingFiles(false);
      }
      // --- End Trigger loading ---
    } else {
      setIsInBrowserProject(false);
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      setSelectedProject(project);
    }
  };

  const handleRefreshProjects = async () => {
    setIsRefreshing(true);
    setIsLoadingFiles(true); // Set loading
    try {
      await refreshProjects();
    } catch (error) {
      console.error("Error refreshing projects list:", error);
    } finally {
      // Loading state for files will be handled by the useEffect reacting to project changes
      setIsRefreshing(false);
    }
  };
  
  // Add resize functionality
  const handleResize = useCallback((e: React.MouseEvent) => {
    if (!onResize || isMobile) return;
    
    const startX = e.clientX;
    const startWidth = 240; // Fixed width when open
    
    const doDrag = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(400, startWidth + moveEvent.clientX - startX));
      onResize(newWidth);
    };
    
    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    
    e.preventDefault();
  }, [onResize, isMobile]);

  // Function to refresh the in-browser file list state
  const refreshInBrowserFiles = useCallback(async () => {
    // console.log('[Sidebar] refreshInBrowserFiles called.'); // Removed simple call log
    setIsLoadingFiles(true); // Set loading
    try {
      const files = await listInBrowserFiles();
      console.info('[Sidebar] Fetched in-browser files:', files.length); // Keep info
      const mappedFiles = files.map(f => ({
        ...f,
        id: f.path, // Ensure ID is set
        created_at: new Date().toISOString(), // Placeholder
        modified_at: new Date().toISOString(), // Placeholder
        size: 0 // Placeholder
      }));
      setInBrowserFiles(mappedFiles); // This should trigger re-render
      // console.log('[Sidebar] Called setInBrowserFiles.'); // Removed simple call log
    } catch (error) {
      console.error('[Sidebar] Failed to refresh in-browser files:', error); // Keep error
    } finally {
      setIsLoadingFiles(false); // Unset loading
    }
  }, [listInBrowserFiles]);

  // Add file upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Check if it's the in-browser project FIRST
    if (isInBrowserProject) {
      setUploadStatus({ message: 'Processing files for browser storage...', severity: 'info' });
      let successCount = 0;
      let errorCount = 0;

      for (const file of acceptedFiles) {
        try {
          setUploadStatus({ message: `Reading ${file.name}...`, severity: 'info', progress: 0 });
          
          // Use FileReader to read the file content
          const reader = new FileReader();
          
          // Create a promise to handle async FileReader
          const readPromise = new Promise<string | ArrayBuffer | null>((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            
            // Read as text for now, might need adjustments for binary files later
            // Consider checking file.type if binary support is needed
            reader.readAsText(file); 
          });

          const fileContent = await readPromise;

          if (fileContent === null) {
            throw new Error(`Failed to read file content for ${file.name}`);
          }
          
          setUploadStatus({ message: `Saving ${file.name} to browser...`, severity: 'info' });

          // Assume saveInBrowserFile takes name and content (string | ArrayBuffer)
          await saveInBrowserFile(file.name, fileContent); 
          
          successCount++;
          setUploadStatus({ message: `${file.name} saved successfully`, severity: 'success' });
          
        } catch (error) {
          console.error(`Error processing file ${file.name} for in-browser storage:`, error);
          setUploadStatus({ message: `Error saving ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, severity: 'error' });
          errorCount++;
          // Continue to next file even if one fails
        }
      }

      // Refresh the list after processing all files
      await refreshInBrowserFiles(); 

      // Final status message
      if (errorCount > 0) {
        setUploadStatus({ message: `Completed: ${successCount} files saved, ${errorCount} errors.`, severity: 'error' });
      } else {
        setUploadStatus({ message: `All ${successCount} files saved successfully.`, severity: 'success' });
      }
      
      setTimeout(() => setUploadStatus(null), errorCount > 0 ? 5000 : 3000); // Show error longer

    } else {
      // --- Existing Remote Upload Logic ---
      if (!selectedProject || !artifactManager) {
        console.warn("Cannot upload: No remote project selected or artifact manager unavailable.");
        setUploadStatus({ message: "Select a remote project first.", severity: 'error' });
        setTimeout(() => setUploadStatus(null), 3000);
        return;
      }

      try {
        setUploadStatus({
          message: 'Preparing remote project for upload...',
          severity: 'info'
        });

        await artifactManager.edit({
          artifact_id: selectedProject.id,
          version: "stage",
          _rkwargs: true
        });

        let uploadSuccessCount = 0;
        let uploadErrorCount = 0;
        
        for (const file of acceptedFiles) {
          try {
            setUploadStatus({
              message: `Uploading ${file.name} to ${selectedProject.manifest.name}...`,
              severity: 'info'
            });

            await uploadFile(selectedProject.id, file);
            uploadSuccessCount++;

            setUploadStatus({
              message: `${file.name} uploaded successfully`,
              severity: 'success'
            });
            // Short delay for success message before next upload
            await new Promise(resolve => setTimeout(resolve, 500)); 

          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            uploadErrorCount++;
            setUploadStatus({
              message: `Error uploading ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              severity: 'error'
            });
            // Longer delay on error to allow user to read
             await new Promise(resolve => setTimeout(resolve, 2000)); 
            // Optional: Decide whether to continue or stop on error
            // continue; 
          }
        }

        // Refresh remote file list only if there were successful uploads or if needed regardless
        if (uploadSuccessCount > 0 || acceptedFiles.length > 0) {
            setUploadStatus({ message: "Refreshing remote file list...", severity: 'info' });
            const files = await getProjectFiles(selectedProject.id);
            setProjectFiles(files);
        }

        // Final status for remote upload
        if (uploadErrorCount > 0) {
            setUploadStatus({ message: `Remote Upload Complete: ${uploadSuccessCount} succeeded, ${uploadErrorCount} failed.`, severity: 'error' });
        } else if (uploadSuccessCount > 0) {
            setUploadStatus({ message: `Remote Upload Complete: ${uploadSuccessCount} files uploaded.`, severity: 'success' });
        } else {
             // Case where no files were processed (e.g., initial try block failed)
            setUploadStatus(null); // Or set a specific message
        }

        setTimeout(() => {
          setUploadStatus(null);
        }, uploadErrorCount > 0 ? 5000 : 3000); // Show error longer

      } catch (error) {
        console.error('Error preparing project for upload:', error);
        setUploadStatus({
          message: `Failed to prepare project for upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        });
         setTimeout(() => setUploadStatus(null), 5000);
      }
    }
  }, [
    selectedProject, 
    uploadFile, 
    getProjectFiles, 
    artifactManager, 
    isInBrowserProject, 
    saveInBrowserFile, 
    refreshInBrowserFiles // Add new dependencies
  ]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: true,
    noKeyboard: true,
    disabled: !selectedProject && !isInBrowserProject // Allow drop for in-browser
  });

  // Handle project deletion
  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent project selection
    setProjectToDelete(projectId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  // Handle creating new chat
  const handleCreateNewChat = async (isInBrowserFile: boolean) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `chat-${timestamp}.ipynb`;
      const newNotebook = {
        metadata: {
          kernelspec: {
            name: "python3",
            display_name: "Python 3"
          },
          language_info: {
            name: "python",
            version: "3.8"
          },
          title: "New Chat",
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        },
        nbformat: 4,
        nbformat_minor: 5,
        cells: []
      };

      if (isInBrowserFile) {
        // Save to InBrowserProject using provider method
        await saveInBrowserFile(fileName, newNotebook);
        
        // Refresh the file list using provider method
        const files = await listInBrowserFiles();
        setInBrowserFiles(files.map(f => ({
          ...f,
          id: f.path,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          size: 0
        })));
        
        // Open the new file
        const newFile: ExtendedProjectFile = {
          name: fileName,
          path: fileName,
          type: 'file',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          size: 0,
          id: fileName
        };
        const project = getInBrowserProject();
        onLoadNotebook(project, newFile);
      } else if (selectedProject && artifactManager) {
        // Save to remote project
        await artifactManager.edit({
          artifact_id: selectedProject.id,
          version: "stage",
          _rkwargs: true
        });
        
        const blob = new Blob([JSON.stringify(newNotebook, null, 2)], { type: 'application/json' });
        const file = new File([blob], fileName, { type: 'application/json' });
        await uploadFile(selectedProject.id, file);
        
        // Refresh the file list
        const files = await getProjectFiles(selectedProject.id);
        setProjectFiles(files);
        
        // Open the new file
        const updatedFile = files.find(f => f.name === fileName);
        if (updatedFile) {
          onLoadNotebook(selectedProject, updatedFile);
        }
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
    setIsAddMenuOpen(false);
  };

  // Wrapper for single-click selection (currently just logs)
  const handleFileSelectWrapper = useCallback(async (file: ProjectFile) => {
    // console.log(`[Sidebar] File selected (single click): ${file.path}`); // Removed single click log
    // No action needed on single click for now
    return Promise.resolve();
  }, []);

  // Wrapper for double-click (loads the notebook)
  const handleFileDoubleClickWrapper = useCallback(async (file: ProjectFile) => {
    if (!selectedProject) {
      console.error("[Sidebar] Cannot load file: No project selected.");
      return Promise.reject("No project selected");
    }
    // console.log(`[Sidebar] File double-clicked: ${file.path}, calling onLoadNotebook.`); // Removed double click log
    // Log the function just before calling it
    // console.log("[Sidebar DoubleClick] Type of onLoadNotebook before call:", typeof onLoadNotebook); // Removed double click log
    // Ensure onLoadNotebook is treated as stable if passed correctly
    onLoadNotebook(selectedProject, file);
    return Promise.resolve();
  }, [selectedProject, onLoadNotebook]);

  // Add refresh button click handler
  const handleRefreshFiles = async () => {
    setIsLoadingFiles(true); // Set loading
    try {
      if (isInBrowserProject) {
        const files = await listInBrowserFiles();
        setInBrowserFiles(files.map(f => ({
          ...f,
          id: f.path,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          size: 0
        })));
      } else if (selectedProject) {
        const files = await getProjectFiles(selectedProject.id);
        setProjectFiles(files);
      }
    } catch (error) {
      console.error("Error refreshing files:", error);
      // Optionally show toast
    } finally {
      setIsLoadingFiles(false); // Unset loading
    }
  };

  // Determine if the current selected project is the in-browser one
  const isSelectedProjectInBrowser = selectedProject?.id === IN_BROWSER_PROJECT.id;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`
        flex-shrink-0 h-full border-r border-gray-200 bg-white 
        transition-width duration-300 ease-in-out overflow-hidden flex flex-col 
        ${isOpen ? 'w-60' : 'w-0 border-none'}
      `}
    >
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-2 border-b border-gray-200 flex justify-between items-center">
          <span className="font-medium text-gray-700">Projects</span>
          <div className="flex gap-1 items-center">
            <button
              onClick={handleRefreshProjects}
              className={`p-1 rounded-md hover:bg-gray-100 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`}
              title="Refresh projects"
            >
              <FaSync className="w-4 h-4" />
            </button>
            <button
              onClick={openCreateDialog}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
              title="Create new project"
            >
              <FaPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Projects Section */}
        <div className="flex-1 overflow-y-auto">
          {/* Login Reminder */}
          {!isLoggedIn && (
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 text-blue-400">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-700">
                      Please log in to access and manage your projects.
                    </p>
                  </div>
                </div>
              </div>
          )}
          {/* InBrowserProject */}
          <div className="py-1">
            <div
              className={`flex items-center w-full px-4 py-2 hover:bg-gray-100 transition-colors ${
                isInBrowserProject ? 'bg-blue-50' : ''
              }`}
            >
              <button
                onClick={() => handleProjectClick('in-browser')}
                className={`flex items-center flex-1 ${
                  isInBrowserProject ? 'text-blue-600' : 'text-gray-600'
                }`}
                title="In-Browser Project"
              >
                <FaLaptop className="w-4 h-4 flex-shrink-0" />
                <span className="ml-3 text-sm truncate">
                  In-Browser Project
                </span>
              </button>
            </div>
          </div>

          {/* Remote Projects */}
          <div className="py-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`group flex items-center w-full px-4 py-2 hover:bg-gray-100 transition-colors ${
                  selectedProject?.id === project.id ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => handleProjectClick(project.id)}
                  className={`flex items-center flex-1 ${
                    selectedProject?.id === project.id ? 'text-blue-600' : 'text-gray-600'
                  }`}
                  title={project.manifest.name}
                >
                  <FaFolder className="w-4 h-4 flex-shrink-0" />
                  <span className="ml-3 text-sm truncate">
                    {project.manifest.name}
                  </span>
                </button>
                <button
                  onClick={(e) => handleDeleteProject(e, project.id)}
                  className="p-1 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors invisible group-hover:visible"
                  title="Delete project"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              </div>
            ))}
            {projects.length === 0 && isLoggedIn && (
              <div className="px-4 py-2 text-sm text-gray-400 italic">
                No remote projects
              </div>
            )}
          </div>

          {/* Project Details Section */}
          {(selectedProject || isInBrowserProject) && (
            <div className="border-t border-gray-200" {...getRootProps()}>
              <div className="p-2">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  {isInBrowserProject ? 'In-Browser Project' : selectedProject?.manifest.name}
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  {isInBrowserProject 
                    ? 'Local files stored in your browser'
                    : selectedProject?.manifest.description}
                </p>
                
                {!isInBrowserProject && selectedProject && (
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span>Version: {selectedProject.manifest.version}</span>
                    <span>Created: {new Date(selectedProject.manifest.created_at).toLocaleDateString()}</span>
                  </div>
                )}

                {/* Upload Status */}
                {uploadStatus && (
                  <div className={`mb-4 p-2 rounded text-sm ${
                    uploadStatus.severity === 'error' ? 'bg-red-50 text-red-700' :
                    uploadStatus.severity === 'success' ? 'bg-green-50 text-green-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {uploadStatus.message}
                  </div>
                )}

                {/* Drag Overlay */}
                {isDragActive && (
                  <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-blue-500 border-dashed rounded-lg z-10 flex items-center justify-center">
                    <div className="text-blue-700 text-center">
                      <FaFile className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Drop files here to upload</p>
                    </div>
                  </div>
                )}

                {/* File Tree */}
                <div className="border-t border-gray-100 pt-2 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-gray-700">Files</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={handleRefreshFiles}
                        className="p-1 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600 transition-colors"
                        title="Refresh files"
                      >
                        <FaSync className="w-3 h-3" />
                      </button>
                      <div className="relative" ref={addButtonRef}>
                        <button
                          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                          className="p-1 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600 transition-colors flex items-center"
                          title="Add new item"
                        >
                          <FaPlus className="w-3 h-3" />
                          <FaChevronDown className="w-2 h-2 ml-1" />
                        </button>
                        <Dropdown 
                          isOpen={isAddMenuOpen} 
                          onClose={() => setIsAddMenuOpen(false)}
                          className="text-sm"
                        >
                          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                            {isInBrowserProject ? 'In-Browser Project' : selectedProject?.manifest.name}
                          </div>
                          <button
                            onClick={() => handleCreateNewChat(isInBrowserProject)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                          >
                            <FaComment className="w-3 h-3 mr-2" />
                            <span>New Chat</span>
                          </button>
                          <label className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center cursor-pointer">
                            <FaUpload className="w-3 h-3 mr-2" />
                            <span>Upload File</span>
                            <input
                              type="file"
                              multiple
                              onChange={(e) => {
                                if (e.target.files) {
                                  onDrop(Array.from(e.target.files));
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </Dropdown>
                      </div>
                    </div>
                  </div>
                  <div className="h-[300px] min-h-[200px] overflow-y-auto relative border border-gray-100 rounded-md">
                    {isLoadingFiles ? (
                      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                        Loading files...
                      </div>
                    ) : (
                      <ProjectFileTree
                        // key: Force remounting ProjectFileTree when the selected project changes.
                        // This ensures the tree component correctly initializes with the new project's
                        // files, especially crucial when switching from/to projects where file 
                        // loading is asynchronous (like remote projects), preventing display issues.
                        key={selectedProject?.id || 'no-project'} 
                        files={isInBrowserProject ? inBrowserFiles : projectFiles}
                        onSelectFile={handleFileSelectWrapper}
                        onDoubleClickFile={handleFileDoubleClickWrapper}
                        onRefreshInBrowserFiles={refreshInBrowserFiles}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-2 border-t border-gray-200 mt-auto">
          <div className="text-xs text-gray-500 text-center">
            Hypha Agents v1.0
          </div>
        </div>
        
        {/* Resize Handle - Only on desktop */}
        {onResize && !isMobile && (
          <div 
            className="sidebar-resizer" 
            onMouseDown={handleResize}
            title="Resize sidebar"
          />
        )}

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setProjectToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Project"
          message="Are you sure you want to delete this project? This action cannot be undone."
        />
      </div>
    </div>
  );
};

export default Sidebar; 