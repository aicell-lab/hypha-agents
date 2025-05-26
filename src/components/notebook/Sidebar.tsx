import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { FaFolder, FaSync, FaPlus, FaFile, FaTrash, FaLaptop, FaChevronDown, FaUpload, FaComment, FaSpinner, FaChevronRight } from 'react-icons/fa';
import { useProjects, ProjectFile, IN_BROWSER_PROJECT, Project } from '../../providers/ProjectsProvider';
import FileTree from '../FileTree';
import { useDropzone } from 'react-dropzone';
import { useHyphaStore } from '../../store/hyphaStore';
import ConfirmDialog from '../common/ConfirmDialog';
import { Splitter } from './Splitter';

import { convertProjectFilesToTreeNodes } from '../../utils/fileTreeConverter';
import { TreeNode } from '../../hooks/useTraverseTree';
import { useParams } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onResize?: (width: number) => void;
  onResizeEnd?: () => void;
  onLoadNotebook: (project: Project, file: ProjectFile) => void;
  notebookMetadata?: {
    filePath?: string;
    [key: string]: any;
  };
  width?: number;
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
  onResizeEnd,
  onLoadNotebook,
  notebookMetadata,
  width
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null); // Added for file deletion
  const [isResizing, setIsResizing] = useState(false); // Track resize state
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
    getInBrowserProject,
    deleteFile,
    deleteInBrowserFile,
    renameFile
  } = useProjects();
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [inBrowserFiles, setInBrowserFiles] = useState<ProjectFile[]>([]);
  const [isInBrowserProject, setIsInBrowserProject] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addButtonRef = useRef<HTMLDivElement>(null);
  // Add new state for TreeNode data
  const [fileTreeData, setFileTreeData] = useState<TreeNode | null>(null);
  // isLoadingFiles: Tracks the loading state for fetching remote project files.
  // This prevents the file tree from rendering with potentially stale data
  // while asynchronous file fetching is in progress.
  // NOW: Also used for loading in-browser files.
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  // Add state for selected files
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Log the received prop on render
  // console.log("[Sidebar Render] Type of onLoadNotebook prop:", typeof onLoadNotebook, onLoadNotebook); // Removed render log

  // Add a helper function at the top of the component to filter out .__dir__ files
  const filterHiddenFiles = (files: ProjectFile[]): ProjectFile[] => {
    return files.filter(file => !file.path.endsWith('.__dir__'));
  };

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
          
          // Filter out hidden files
          const filteredFiles = filterHiddenFiles(files);
          
          console.info('[Sidebar] Loaded files:', filteredFiles.length); // Keep info
          setProjectFiles(prevFiles => {
            // console.log('[Sidebar Debug] Updating projectFiles state. Previous:', prevFiles, 'New:', files); // Removed debug
            return filteredFiles;
          });
          
          // Convert to TreeNode format for our FileTree component
          const treeData = convertProjectFilesToTreeNodes(filteredFiles);
          setFileTreeData(treeData);
        } catch (error) {
          console.error('Error loading project files:', error); // Keep error
          // console.log('[Sidebar Debug] Error loading project files:', error); // Removed debug
          setProjectFiles([]); // Clear files on error
          setFileTreeData(null); // Clear tree data
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
      // --- Trigger loading --- 
      setIsLoadingFiles(true);
      try {
        const files = await listInBrowserFiles();
        const mappedFiles = files.map(f => ({
          ...f,
          id: f.path,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          size: 0
        }));
        setInBrowserFiles(mappedFiles);
        
        // Convert to TreeNode format for our FileTree component
        const treeData = convertProjectFilesToTreeNodes(files);
        setFileTreeData(treeData);
      } catch (error) {
        console.error("Failed to load in-browser files on click:", error);
        setInBrowserFiles([]);
        setFileTreeData(null);
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
      
      // Convert to TreeNode format for our FileTree component
      const treeData = convertProjectFilesToTreeNodes(files);
      setFileTreeData(treeData);
      
      // console.log('[Sidebar] Called setInBrowserFiles.'); // Removed simple call log
    } catch (error) {
      console.error('[Sidebar] Failed to refresh in-browser files:', error); // Keep error
      setFileTreeData(null);
    } finally {
      setIsLoadingFiles(false); // Unset loading
    }
  }, [listInBrowserFiles]);

  // Add handlers for FileTree component
  const handleInsertNode = (folderId: string, itemName: string, isFolder: boolean) => {
    // This would be a placeholder until we implement actual file/folder creation
    console.log(`Creating ${isFolder ? 'folder' : 'file'} "${itemName}" in "${folderId}"`);
    // In a real implementation, you would call an API to create the file/folder
  };

  const handleDeleteNode = (nodeId: string) => {
    // Find the file by path
    const filePath = nodeId;
    if (!selectedProject) return;

    // Confirm delete (reuse existing delete functionality)
    setFileToDelete(filePath);
    setShowDeleteConfirm(true);
  };

  const handleUpdateFolder = async (nodeId: string, newName: string, isFolder: boolean) => {
    if (!selectedProject) return;
    
    try {
      // Currently we only support file renaming, not folders
      if (isFolder) {
        console.warn("Folder renaming not yet implemented");
        return;
      }
      
      // Get the old path (nodeId represents the full path)
      const oldPath = nodeId;
      
      // Extract directory part from the old path if it exists
      let directory = '';
      const lastSlashIndex = oldPath.lastIndexOf('/');
      if (lastSlashIndex >= 0) {
        directory = oldPath.substring(0, lastSlashIndex + 1);
      }
      
      // Construct new path by combining directory and new name
      const newPath = directory + newName;
      
      console.log(`Renaming "${oldPath}" to "${newPath}"`);
      
      // Don't set loading state - keep current tree visible
      
      try {
        // Step 1: Create an optimistic update of the file tree to show the rename immediately
        if (fileTreeData) {
          // Find the node in the tree and update it optimistically
          const updatedTree = JSON.parse(JSON.stringify(fileTreeData)); // Deep clone
          const updateNodeInTree = (node: TreeNode) => {
            if (node.id === oldPath) {
              node.id = newPath;
              node.name = newName;
              return true;
            }
            if (node.items) {
              for (const item of node.items) {
                if (updateNodeInTree(item)) return true;
              }
            }
            return false;
          };
          
          // Try to update the tree
          if (updateNodeInTree(updatedTree)) {
            // If we found and updated the node, update the tree data
            setFileTreeData(updatedTree);
            // Also update the selection
            setSelectedFileIds([newPath]);
          }
        }
        
        // Step 2: Perform the actual rename operation
        await renameFile(selectedProject.id, oldPath, newPath);
        
        // Step 3: Refresh the file list in the background
        let newFiles: ProjectFile[] = [];
        
        if (isInBrowserProject) {
          const inBrowserFiles = await listInBrowserFiles();
          newFiles = inBrowserFiles;
          
          const mappedFiles = inBrowserFiles.map(f => ({
            ...f,
            id: f.path,
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            size: 0
          }));
          setInBrowserFiles(mappedFiles);
        } else {
          // For remote projects, explicitly refresh the file list
          console.log('Refreshing remote files after rename');
          newFiles = await getProjectFiles(selectedProject.id);
          console.log('Updated files:', newFiles);
          
          // Set state
          setProjectFiles(newFiles);
        }
        
        // Step 4: Update the tree data with the refreshed files
        const treeData = convertProjectFilesToTreeNodes(newFiles);
        setFileTreeData(treeData);
        
        // Ensure selection is set to the new file path
        setSelectedFileIds([newPath]);
        console.log('Updated selection to:', newPath);
      } catch (err) {
        console.error('Error during rename operation:', err);
        
        // If there's an error, we need to refresh to get the correct state
        setIsLoadingFiles(true);
        
        try {
          // Refresh files to get the correct state
          if (isInBrowserProject) {
            const inBrowserFiles = await listInBrowserFiles();
            const mappedFiles = inBrowserFiles.map(f => ({
              ...f,
              id: f.path,
              created_at: new Date().toISOString(),
              modified_at: new Date().toISOString(),
              size: 0
            }));
            setInBrowserFiles(mappedFiles);
            
            const treeData = convertProjectFilesToTreeNodes(inBrowserFiles);
            setFileTreeData(treeData);
          } else {
            const files = await getProjectFiles(selectedProject.id);
            setProjectFiles(files);
            
            const treeData = convertProjectFilesToTreeNodes(files);
            setFileTreeData(treeData);
          }
        } catch (refreshErr) {
          console.error('Error refreshing files after failed rename:', refreshErr);
        } finally {
          setIsLoadingFiles(false);
        }
        
        throw err; // Rethrow to be caught by outer try/catch
      }
    } catch (error) {
      console.error("Error renaming file:", error);
      // Could show an error toast here
    }
  };

  // File click handler that works with TreeNode structure
  const handleFileDoubleClick = (fileId: string) => {
    const currentFiles = isInBrowserProject ? inBrowserFiles : projectFiles;
    const selectedFile = currentFiles.find(f => f.path === fileId);
    
    if (selectedFile && selectedProject) {
      console.log(`Loading file: ${fileId}`);
      onLoadNotebook(selectedProject, selectedFile);
    }
  };

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

  const confirmProjectDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    }
  };

  // Handle file deletion
  const confirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      if (selectedProject?.id === 'in-browser') {
        await deleteInBrowserFile(fileToDelete);
        await refreshInBrowserFiles(); // This already updates the tree data
      } else if (selectedProject?.id) {
        await deleteFile(selectedProject.id, fileToDelete);
        const files = await getProjectFiles(selectedProject.id);
        
        // Filter out hidden files
        const filteredFiles = filterHiddenFiles(files);
        setProjectFiles(filteredFiles);
        
        // Update tree data with filtered files
        const treeData = convertProjectFilesToTreeNodes(filteredFiles);
        setFileTreeData(treeData);
      } else {
        console.error('No project selected or invalid project ID for deletion');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      setShowDeleteConfirm(false);
      setFileToDelete(null);
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
        // Filter out hidden files
        const filteredFiles = filterHiddenFiles(files);
        setProjectFiles(filteredFiles);
        
        // Update tree with filtered files
        const treeData = convertProjectFilesToTreeNodes(filteredFiles);
        setFileTreeData(treeData);
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

  // Add a function to handle file selection from FileTree
  const handleFileSelection = useCallback((fileIds: string[]) => {
    setSelectedFileIds(fileIds);
    
    // If a single file is selected, find the file and handle the double-click action
    if (fileIds.length === 1) {
      const selectedFileId = fileIds[0];
      const currentFiles = isInBrowserProject ? inBrowserFiles : projectFiles;
      const selectedFile = currentFiles.find(f => f.path === selectedFileId);
      
      if (selectedFile) {
        // We could load the file here if needed, but we'll keep that for double-click
        console.log(`File selected: ${selectedFile.path}`);
      }
    }
  }, [isInBrowserProject, inBrowserFiles, projectFiles]);

  // Set initial selection based on current notebook file
  useEffect(() => {
    if (notebookMetadata?.filePath && selectedProject) {
      // Determine which files array to use based on the project type
      const files = isInBrowserProject ? inBrowserFiles : projectFiles;
      
      // Find the matching file by path
      const fileToSelect = files.find(file => file.path === notebookMetadata.filePath);
      
      if (fileToSelect) {
        // Set the selected file ID 
        setSelectedFileIds([fileToSelect.path]);
        console.log('Auto-selected file:', fileToSelect.path);
      }
    }
  }, [notebookMetadata?.filePath, selectedProject, projectFiles, inBrowserFiles, isInBrowserProject]);

  // Define the function to handle directory opening
  const handleOpenDirectory = useCallback(async (path: string) => {
    if (!selectedProject || selectedProject.id === 'in-browser') {
      // In-browser files are always fully loaded, no action needed
      return;
    }

    // Check if children for this path are already loaded (simple check)
    const findNode = (node: TreeNode | null, targetPath: string): TreeNode | null => {
      if (!node) return null;
      if (node.id === targetPath) return node;
      if (node.items) {
        for (const item of node.items) {
          const found = findNode(item, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const targetNode = findNode(fileTreeData, path);
    if (targetNode && targetNode.items && targetNode.items.length > 0) {
      console.info(`[Sidebar] Children for ${path} already loaded.`);
      return; // Already loaded
    }

    console.info(`[Sidebar] Opening directory: ${path}`);
    setIsLoadingFiles(true); // Indicate loading
    try {
      const childFiles = await getProjectFiles(selectedProject.id, path + '/'); // Add trailing slash for prefix
      const filteredChildFiles = filterHiddenFiles(childFiles);

      // Update the main projectFiles state if needed (or just update the tree)
      // It might be better to just merge into the tree structure directly

      // Update the fileTreeData state by merging the new children
      const updateTree = (node: TreeNode): TreeNode => {
        if (node.id === path) {
          // Convert fetched files to TreeNode format, passing the base path
          const childrenNodes = convertProjectFilesToTreeNodes(filteredChildFiles, path + '/').items;
          return { ...node, items: childrenNodes };
        }
        if (node.items) {
          return { ...node, items: node.items.map(updateTree) };
        }
        return node;
      };

      setFileTreeData(prevTreeData => {
        if (!prevTreeData) return null;
        const newTree = updateTree(prevTreeData);
        console.log("[Sidebar] Updated tree data after opening dir:", newTree);
        return newTree;
      });

    } catch (error) {
      console.error(`[Sidebar] Error loading directory contents for ${path}:`, error);
      // Optionally show error toast
    } finally {
      setIsLoadingFiles(false);
    }
  }, [selectedProject, getProjectFiles, fileTreeData, listInBrowserFiles, filterHiddenFiles]);

  // Memoize the container style to reduce re-renders during dragging
  const containerStyle = useMemo(() => ({
    width: isOpen ? `${width || 240}px` : '0px',
    transition: isResizing ? 'none' : 'width 300ms ease-in-out' // Disable transition during resize
  }), [isOpen, width, isResizing]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`
        flex-shrink-0 h-full border-r border-gray-200 bg-white relative
        overflow-hidden flex flex-col 
        ${isOpen ? '' : 'w-0 border-none'}
      `}
      style={containerStyle}
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
            <div className="border-t border-gray-200 flex-1 flex flex-col overflow-hidden" {...getRootProps()}>
              <div className="p-2 flex-shrink-0">
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
              </div>

              {/* File Tree */}
              <div className="border-t border-gray-100 pt-2 flex-1 overflow-hidden flex flex-col px-2">
                <div className="flex-1 overflow-y-auto relative border border-gray-100 rounded-md">
                  {fileTreeData && (
                    <FileTree
                      explorerData={fileTreeData}
                      handleInsertNode={handleInsertNode}
                      handleDeleteNode={handleDeleteNode}
                      handleUpdateFolder={handleUpdateFolder}
                      onFileDoubleClick={handleFileDoubleClick}
                      showRoot={false}
                      selectedFiles={selectedFileIds}
                      onSelection={handleFileSelection}
                      showControls={true}
                      onRefresh={handleRefreshFiles}
                      isLoading={isLoadingFiles}
                      onOpenDirectory={handleOpenDirectory}
                      rootActions={[
                        {
                          label: "New Chat",
                          icon: <FaComment className="w-3 h-3" />,
                          onClick: () => handleCreateNewChat(isInBrowserProject)
                        },
                        {
                          label: "New File",
                          icon: <FaFile className="w-3 h-3" />,
                          onClick: async () => {
                            if (!selectedProject) return;
                            
                            // Create a timestamp-based file name
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            const fileName = `file-${timestamp}.txt`;
                            
                            try {
                              if (isInBrowserProject) {
                                // For in-browser project, create an empty file
                                await saveInBrowserFile(fileName, "");
                                await refreshInBrowserFiles();
                              } else {
                                // For remote projects
                                // Create an empty blob
                                const emptyBlob = new Blob([""], { type: 'text/plain' });
                                const emptyFile = new File([emptyBlob], fileName, { type: 'text/plain' });
                                
                                // Upload the empty file
                                await uploadFile(selectedProject.id, emptyFile);
                                
                                // Refresh the files list
                                const files = await getProjectFiles(selectedProject.id);
                                setProjectFiles(files);
                                
                                // Update the tree
                                const treeData = convertProjectFilesToTreeNodes(files);
                                setFileTreeData(treeData);
                              }
                            } catch (error) {
                              console.error("Error creating new file:", error);
                            }
                          }
                        },
                        {
                          label: "New Folder",
                          icon: <FaFolder className="w-3 h-3" />,
                          onClick: async () => {
                            if (!selectedProject) return;
                            
                            // Prompt for folder name
                            const folderName = prompt("Enter folder name:");
                            if (!folderName) return;
                            
                            try {
                              if (isInBrowserProject) {
                                // For in-browser project, we just need to create a file with the path structure
                                // We'll create an empty file with the folder path to represent the folder
                                await saveInBrowserFile(`${folderName}/.__dir__`, "");
                                await refreshInBrowserFiles();
                              } else {
                                // For remote S3 projects, create a hidden marker file to represent the folder
                                const markerFileName = `${folderName}/.__dir__`;
                                const emptyBlob = new Blob([""], { type: 'text/plain' });
                                const markerFile = new File([emptyBlob], markerFileName, { type: 'text/plain' });
                                
                                // Upload the marker file
                                await uploadFile(selectedProject.id, markerFile);
                                
                                // Refresh the files list
                                const files = await getProjectFiles(selectedProject.id);
                                
                                // Filter out the .__dir__ files before display
                                const filteredFiles = filterHiddenFiles(files);
                                setProjectFiles(filteredFiles);
                                
                                // Update the tree, but filter out .__dir__ files
                                const treeData = convertProjectFilesToTreeNodes(filteredFiles);
                                setFileTreeData(treeData);
                              }
                            } catch (error) {
                              console.error("Error creating new folder:", error);
                            }
                          }
                        },
                        {
                          label: "Upload File",
                          icon: <FaUpload className="w-3 h-3" />,
                          onClick: () => {
                            // Create a hidden file input and trigger it
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = true;
                            input.onchange = (e) => {
                              const target = e.target as HTMLInputElement;
                              if (target.files) {
                                onDrop(Array.from(target.files));
                              }
                            };
                            input.click();
                          }
                        }
                      ]}
                    />
                  )}
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
        {onResize && !isMobile && isOpen && (
          <Splitter
            onResize={onResize}
            onResizeStart={() => setIsResizing(true)}
            onResizeEnd={() => {
              setIsResizing(false);
              onResizeEnd?.();
            }}
            minWidth={240}
            maxWidth={500}
            position="right"
          />
        )}

        <ConfirmDialog
          isOpen={showDeleteConfirm && projectToDelete !== null}
          onClose={() => {
            setShowDeleteConfirm(false);
            setProjectToDelete(null);
          }}
          onConfirm={confirmProjectDelete}
          title="Delete Project"
          message="Are you sure you want to delete this project? This action cannot be undone."
        />

        <ConfirmDialog
          isOpen={showDeleteConfirm && fileToDelete !== null}
          onClose={() => {
            setShowDeleteConfirm(false);
            setFileToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete File"
          message="Are you sure you want to delete this file? This action cannot be undone."
        />
      </div>
    </div>
  );
};

export default Sidebar; 