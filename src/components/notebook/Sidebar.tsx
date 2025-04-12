import React, { useCallback, useEffect, useState } from 'react';
import { FaBook, FaCode, FaFolder, FaSync, FaPlus, FaFile, FaTrash } from 'react-icons/fa';
import { useProjects, ProjectFile } from '../../providers/ProjectsProvider';
import ProjectFileTree from './ProjectFileTree';
import { useDropzone } from 'react-dropzone';
import { useHyphaStore } from '../../store/hyphaStore';
import ConfirmDialog from '../common/ConfirmDialog';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onResize?: (width: number) => void;
  onSelectFile: (file: ProjectFile) => Promise<void>;
}

// Add upload status type
interface UploadStatus {
  message: string;
  severity: 'info' | 'success' | 'error';
  progress?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  onResize,
  onSelectFile
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
  } = useProjects();
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'details'>('list');

  // Load project files when a project is selected
  useEffect(() => {
    const loadProjectFiles = async () => {
      if (!selectedProject) {
        setProjectFiles([]);
        return;
      }

      try {
        console.info('[Sidebar] Loading files for project:', selectedProject.id);
        const files = await getProjectFiles(selectedProject.id);
        console.info('[Sidebar] Loaded files:', files.length);
        setProjectFiles(files);
      } catch (error) {
        console.error('Error loading project files:', error);
      }
    };

    loadProjectFiles();
  }, [selectedProject, getProjectFiles]);

  // Add effect to log projectFiles changes
  useEffect(() => {
    console.info('[Sidebar] Project files updated:', projectFiles.length);
  }, [projectFiles]);
  
  // Detect mobile screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Handle project selection
  const handleProjectClick = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    setSelectedProject(project);
  };

  const handleRefreshProjects = async () => {
    setIsRefreshing(true);
    await refreshProjects();
    setIsRefreshing(false);
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

  // Add file upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedProject || !artifactManager) return;

    try {
      setUploadStatus({
        message: 'Preparing for upload...',
        severity: 'info'
      });

      await artifactManager.edit({
        artifact_id: selectedProject.id,
        version: "stage",
        _rkwargs: true
      });

      for (const file of acceptedFiles) {
        try {
          setUploadStatus({
            message: `Uploading ${file.name}...`,
            severity: 'info'
          });

          await uploadFile(selectedProject.id, file);

          setUploadStatus({
            message: `${file.name} uploaded successfully`,
            severity: 'success'
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          setUploadStatus({
            message: `Error uploading ${file.name}`,
            severity: 'error'
          });
          continue;
        }
      }

      const files = await getProjectFiles(selectedProject.id);
      setProjectFiles(files);

      setTimeout(() => {
        setUploadStatus(null);
      }, 2000);

    } catch (error) {
      console.error('Error preparing project for upload:', error);
      setUploadStatus({
        message: 'Failed to prepare for upload. Please try again.',
        severity: 'error'
      });
    }
  }, [selectedProject, uploadFile, getProjectFiles, artifactManager]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: true,
    noKeyboard: true,
    disabled: !selectedProject
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

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed top-0 left-0 h-full border-r border-gray-200 bg-white transition-transform duration-300 flex flex-col"
      style={{ 
        width: '240px', 
        zIndex: 40,
        marginTop: '48px', // Height of the header
        height: 'calc(100vh - 48px)', // Full height minus header
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        willChange: 'transform'
      }}
    >
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
        {/* Projects List */}
        <div className="py-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`flex items-center w-full px-4 py-2 hover:bg-gray-100 transition-colors ${
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
                className="p-1 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete project"
              >
                <FaTrash className="w-3 h-3" />
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="px-4 py-2 text-sm text-gray-400 italic">
              No projects
            </div>
          )}
        </div>

        {/* Project Details Section */}
        {selectedProject && (
          <div className="border-t border-gray-200" {...getRootProps()}>
            <div className="p-2">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                {selectedProject.manifest.name}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {selectedProject.manifest.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>Version: {selectedProject.manifest.version}</span>
                <span>Created: {new Date(selectedProject.manifest.created_at).toLocaleDateString()}</span>
              </div>

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
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-700">Files</h4>
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        if (!selectedProject) return;
                        const files = await getProjectFiles(selectedProject.id);
                        setProjectFiles(files);
                      }}
                      className="p-1 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600 transition-colors"
                      title="Refresh files"
                    >
                      <FaSync className="w-3 h-3" />
                    </button>
                    <label className="p-1 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600 transition-colors">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) {
                            onDrop(Array.from(e.target.files));
                          }
                        }}
                        className="hidden"
                        title="Upload files"
                      />
                      <FaPlus className="w-3 h-3" />
                    </label>
                  </div>
                </div>
                <div className="h-[300px] min-h-[200px] overflow-y-auto relative border border-gray-100 rounded-md p-2">
                  <ProjectFileTree
                    key={projectFiles.length}
                    files={projectFiles}
                    onSelectFile={onSelectFile}
                  />
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
  );
};

export default Sidebar; 