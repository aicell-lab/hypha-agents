import React, { useState, useEffect, useCallback, Fragment } from 'react';
import Editor from '@monaco-editor/react';
import { useHyphaStore } from '../store/hyphaStore';
import { LinearProgress, Dialog as MuiDialog, TextField, FormControlLabel, Checkbox, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import yaml from 'js-yaml';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Comments from './Comments';
import ResourceCard from './ResourceCard';
import { Resource } from '../types';
import { useDropzone } from 'react-dropzone';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ModelTester from './ModelTester';
import ModelValidator from './ModelValidator';
import Chat from './chat/Chat';
import { LazyThebeProvider } from './chat/ThebeProvider';
import { SITE_NAME } from '../utils/env';

interface FileNode {
  name: string;
  path: string;
  content?: string | ArrayBuffer;
  isDirectory: boolean;
  children?: FileNode[];
  edited?: boolean;
  isCommentsFile?: boolean;
}

// Add this interface for the tab type
interface ContentTab {
  id: 'files' | 'review' | 'config' | 'chat';
  label: string;
  icon: React.ReactNode;
}

// Add new interface for artifact info
interface ArtifactInfo {
  name: string;
  id: string;
  description?: string;
  version?: string;
  versions?: string[];
  config?: {
    covers?: string[];
    icon?: string;
    id_emoji?: string;
    tags?: string[];
    badges?: any[];
    authors?: string[];
    license?: string;
    documentation?: string;
  };
  created_at?: number;
  last_modified?: number;
  manifest: {
    name: string;
    description: string;
    welcomeMessage: string;
    extensions: string[];
    visibility: 'public' | 'private';
  };
}

// Add this interface near the top with other interfaces
interface PublishData {
  version?: string;
  comment: string;
}

// Add this type definition near other interfaces
interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  handler: (e: KeyboardEvent) => void;
}

interface ValidationResult {
  success: boolean;
  message?: string;
}

interface FileListItem {
  type: 'file' | 'directory';
  name: string;
}

// Add new interface for agent config
interface AgentConfig {
  // Basic Info
  name: string;
  description: string;
  welcomeMessage: string;
  
  // Runtime Configuration
  agent_config: {
    // Identity
    name: string;
    profile: string;
    goal: string;
    
    // Model Settings
    model: string;
    stream?: boolean;
    instructions?: string;

    // Voice Settings
    voice?: string;
    temperature?: number;
    max_output_tokens?: number;

    // Tools Configuration
    enabled_tools?: string[];
  };
}

// Add new interface for tool options
interface ToolOption {
  id: string;
  name: string;
  description: string;
}

// Add available voice options
const VOICE_OPTIONS = [
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer'
] as const;

const Edit: React.FC = () => {
  const { artifactId } = useParams<{ artifactId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const { schemaAgents, artifactManager, isLoggedIn, server } = useHyphaStore();
  const [uploadStatus, setUploadStatus] = useState<{
    message: string;
    severity: 'info' | 'success' | 'error';
    progress?: number;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<{[key: string]: string}>({});
  const [showComments, setShowComments] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'files' | 'review' | 'config' | 'chat'>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam?.startsWith('@')) {
      return 'files';
    }
    return (tabParam as 'files' | 'review' | 'config' | 'chat') || 'config';
  });
  const [artifactInfo, setArtifactInfo] = useState<ArtifactInfo | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStaged, setIsStaged] = useState<boolean>(false);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [newVersionData, setNewVersionData] = useState({
    copyFiles: true
  });
  const [copyProgress, setCopyProgress] = useState<{
    current: number;
    total: number;
    file: string;
  } | null>(null);
  const [publishData, setPublishData] = useState<PublishData>({
    version: '',
    comment: ''
  });
  const [isContentValid, setIsContentValid] = useState<boolean>(true);
  const [hasContentChanged, setHasContentChanged] = useState<boolean>(false);

  // Add new state for agent config
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    // Basic Info
    name: '',
    description: '',
    welcomeMessage: 'Hello, how can I assist you today?',
    
    // Runtime Configuration
    agent_config: {
      // Identity
      name: '',
      profile: 'AI Assistant',
      goal: 'I am a helpful AI assistant',
      
      // Model Settings
      model: 'gpt-4o-mini',
      stream: true
    }
  });

  // Add new state for available extensions
  const [availableExtensions, setAvailableExtensions] = useState<Array<{id: string, name: string, description: string}>>([]);

  // Add available tools state
  const [availableTools] = useState<ToolOption[]>([
    {
      id: 'code_interpreter',
      name: 'Code Interpreter',
      description: 'Execute Python code and display results'
    },
    {
      id: 'web_search',
      name: 'Web Search',
      description: 'Search the internet for information'
    },
    {
      id: 'file_manager',
      name: 'File Manager',
      description: 'Upload, download, and manage files'
    }
  ]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (artifactId && artifactManager && isLoggedIn) {
      loadArtifactFiles();
    }
  }, [artifactId, artifactManager, isLoggedIn]);

  const isTextFile = (filename: string): boolean => {
    const textExtensions = ['.txt', '.yml', '.yaml', '.json', '.md', '.py', '.js', '.ts', '.jsx', '.tsx', '.css', '.html'];
    return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    return imageExtensions.some(ext => filename.toLowerCase().split('.').pop()?.toLowerCase() === ext);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getImageDataUrl = async (content: string | ArrayBuffer, fileName: string): Promise<string> => {
    let buffer: ArrayBuffer;
    if (typeof content === 'string') {
      const encoder = new TextEncoder();
      buffer = encoder.encode(content).buffer;
    } else {
      buffer = content;
    }

    const extension = fileName.toLowerCase().split('.').pop() || '';
    const bytes = new Uint8Array(buffer);
    const binary = bytes.reduce((data, byte) => data + String.fromCharCode(byte), '');
    const base64 = btoa(binary);
    
    const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return `data:${mimeType};base64,${base64}`;
  };

  const getEditorLanguage = (filename: string): string => {
    const extension = filename.toLowerCase().split('.').pop() || '';
    const languageMap: Record<string, string> = {
      'py': 'python',
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'css': 'css',
      'html': 'html',
      'json': 'json',
      'yml': 'yaml',
      'yaml': 'yaml',
      'md': 'markdown',
      'txt': 'plaintext'
    };
    return languageMap[extension] || 'plaintext';
  };

  const loadArtifactFiles = async () => {
    if (!artifactManager || !artifactId) return;
    
    try {
      setUploadStatus({
        message: 'Loading files...',
        severity: 'info'
      });

      // Get artifact info with full manifest
      const artifact = await artifactManager.read({
        artifact_id: artifactId,
        _rkwargs: true
      });
      
      // Set isStaged based on artifact staging status
      const staged = artifact.staging !== null;
      setIsStaged(staged);

      // List all files using the correct version
      const fileList = await artifactManager.list_files({
        artifact_id: artifactId,
        version: staged ? 'stage' : null,
        _rkwargs: true
      });

      // Get the latest version from versions array, or use 'stage' if in staging
      const currentVersion = staged ? 'stage' : 
        (artifact.versions && artifact.versions.length > 0 ? 
          artifact.versions[artifact.versions.length - 1] : 
          undefined);

      // Set full artifact info including all manifest fields
      setArtifactInfo({
        name: artifact.manifest.name,
        id: artifactId,
        description: artifact.manifest.description,
        version: currentVersion,
        versions: artifact.versions || [],
        manifest: {
          ...artifact.manifest,
          welcomeMessage: artifact.manifest.welcomeMessage || 'Hello, how can I assist you today?',
          extensions: artifact.manifest.extensions || [],
          visibility: artifact.manifest.visibility || 'private'
        }
      });

      if (!fileList || fileList.length === 0) {
        setFiles([]);
        setUploadStatus({
          message: 'No files found',
          severity: 'info'
        });
        return;
      }

      // Convert the file list to FileNode format
      const nodes: FileNode[] = fileList.map((file: any) => ({
        name: file.name,
        path: file.name,
        isDirectory: file.type === 'directory',
        children: file.type === 'directory' ? [] : undefined,
        isCommentsFile: file.name === 'comments.json'
      }));

      setFiles(nodes);
      setUploadStatus({
        message: 'Files loaded successfully',
        severity: 'success'
      });

      // Clear the status after a short delay
      setTimeout(() => {
        setUploadStatus(null);
      }, 2000);

    } catch (error) {
      console.error('Error loading artifact files:', error);
      setUploadStatus({
        message: 'Error loading files',
        severity: 'error'
      });
    }
  };

  const fetchFileContent = async (file: FileNode) => {
    if (!artifactManager || file.isDirectory) return;

    try {
      setUploadStatus({
        message: 'Loading file content...',
        severity: 'info'
      });

      const url = await artifactManager.get_file({
        artifact_id: artifactId,
        file_path: file.path,
        version: isStaged ? 'stage' : null,
        _rkwargs: true
      });
      
      const response = await fetch(url);
      const content = isTextFile(file.name) ? 
        await response.text() : 
        await response.arrayBuffer();

      setUploadStatus({
        message: 'File loaded successfully',
        severity: 'success'
      });

      return content;
    } catch (error) {
      console.error('Error fetching file content:', error);
      setUploadStatus({
        message: 'Error loading file content',
        severity: 'error'
      });
    }
  };

  const handleFileSelect = async (file: FileNode) => {
    // First check if the file still exists in our files array
    const fileExists = files.some(f => f.path === file.path);
    if (!fileExists) {
      setUploadStatus({
        message: `File ${file.name} no longer exists`,
        severity: 'error'
      });
      return;
    }

    // Only update URL if it's different from current selection
    const currentPath = searchParams.get('tab')?.substring(1);
    if (currentPath !== file.path) {
      handleTabChange('files', file.path);
    }
    
    setSelectedFile(file);
    setImageUrl(null);
    
    // Only fetch content if it hasn't been loaded yet
    if (!file.content) {
      const content = await fetchFileContent(file);
      if (content) {
        // Create updated file with content
        const updatedFile = { ...file, content };
        
        // Update selected file
        setSelectedFile(updatedFile);
        
        // Update file in files array while preserving other files
        setFiles(prevFiles => 
          prevFiles.map(f => 
            f.path === file.path ? updatedFile : f
          )
        );

        if (isImageFile(file.name)) {
          try {
            const url = await getImageDataUrl(content, file.name);
            setImageUrl(url);
          } catch (error) {
            console.error('Error generating image URL:', error);
          }
        }
      }
    } else if (isImageFile(file.name)) {
      // If content is already loaded, just generate the image URL
      try {
        const url = await getImageDataUrl(file.content, file.name);
        setImageUrl(url);
      } catch (error) {
        console.error('Error generating image URL:', error);
      }
    }
  };

  const handleEditorChange = (value: string | undefined, file: FileNode) => {
    if (!value || !file) return;
    
    // Store unsaved changes in state
    setUnsavedChanges(prev => ({
      ...prev,
      [file.path]: value
    }));

    // Mark content as changed and invalidate previous validation
    setHasContentChanged(true);
    setIsContentValid(false);
  };

  const handleSave = async (file: FileNode) => {
    if (!artifactManager || !unsavedChanges[file.path]) return;

    try {
      setUploadStatus({
        message: 'Saving changes...',
        severity: 'info'
      });

      // Get the presigned URL for uploading
      const presignedUrl = await artifactManager.put_file({
        artifact_id: artifactId,
        file_path: file.path,
        _rkwargs: true
      });

      // Upload the file content
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: unsavedChanges[file.path],
        headers: {
          'Content-Type': '' // important for s3
        }
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      // Update the local state
      setFiles(files.map(f => 
        f.path === file.path 
          ? { ...f, content: unsavedChanges[file.path], edited: true }
          : f
      ));

      // Clear unsaved changes for this file
      setUnsavedChanges(prev => {
        const newState = { ...prev };
        delete newState[file.path];
        return newState;
      });

      setUploadStatus({
        message: 'Changes saved',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving changes:', error);
      setUploadStatus({
        message: 'Error saving changes',
        severity: 'error'
      });
    }
  };

  const handleBack = () => {
    navigate('/my-agents');
  };

  const handlePublish = async () => {
    try {
      setUploadStatus({
        message: 'Publishing artifact...',
        severity: 'info'
      });
      
      const artifact = await artifactManager?.commit({
        artifact_id: artifactId,
        version: publishData.version?.trim() || null,
        comment: publishData.comment || 'Published to Model Zoo',
        _rkwargs: true
      });

      setUploadStatus({
        message: 'Changes committed successfully',
        severity: 'success'
      });
      
      setShowPublishDialog(false);
      
      // Clear edited flags after successful commit
      setFiles(prevFiles => 
        prevFiles.map(f => ({
          ...f,
          edited: false
        }))
      );

      // Navigate back to My Agents after successful publish
      navigate('/my-agents');

    } catch (error) {
      console.error('Error publishing artifact:', error);
      setUploadStatus({
        message: 'Error publishing artifact',
        severity: 'error'
      });
    }
  };

  const getResourcePreview = (): Resource | null => {
    if (!artifactInfo) return null;
    
    return {
      id: artifactInfo.id,
      manifest: {
        name: artifactInfo.name,
        description: artifactInfo.description || '',
        covers: artifactInfo.config?.covers || [],
        icon: artifactInfo.config?.icon,
        id_emoji: artifactInfo.config?.id_emoji,
        tags: artifactInfo.config?.tags || [],
        badges: artifactInfo.config?.badges || [],
        authors: artifactInfo.config?.authors || [],
        license: artifactInfo.config?.license || '',
        documentation: artifactInfo.config?.documentation || '',
        version: artifactInfo.version || '1.0',
        type: 'agent'
      },
      config: artifactInfo.config || {},
      type: 'agent',
      created_at: artifactInfo.created_at || Date.now(),
      last_modified: artifactInfo.last_modified || Date.now(),
    };
  };

  const renderFileContent = () => {
    if (!selectedFile) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          Select a file to view or edit
        </div>
      );
    }

    if (!selectedFile.content) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500">Loading file content...</div>
        </div>
      );
    }

    if (isImageFile(selectedFile.name)) {
      return (
        <div className="flex flex-col gap-4">
          {imageUrl ? (
            <img 
              src={imageUrl}
              alt={selectedFile.name} 
              className="max-w-full h-auto"
            />
          ) : (
            <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg">
              <div className="text-gray-400">Loading image...</div>
            </div>
          )}
        </div>
      );
    }

    if (isTextFile(selectedFile.name)) {
      return (
        <div className="flex flex-col gap-4">
          <Editor
            height="70vh"
            language={getEditorLanguage(selectedFile.name)}
            value={unsavedChanges[selectedFile.path] ?? 
              (typeof selectedFile.content === 'string' ? selectedFile.content : '')}
            onChange={(value) => handleEditorChange(value, selectedFile)}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: true,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              folding: true
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="font-medium text-lg mb-4">File Information</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {selectedFile.name}</p>
            <p><span className="font-medium">Size:</span> {formatFileSize(selectedFile.content instanceof ArrayBuffer ? selectedFile.content.byteLength : selectedFile.content.length)}</p>
            <p><span className="font-medium">Type:</span> {selectedFile.name.split('.').pop()?.toUpperCase() || 'Unknown'}</p>
          </div>
          <p className="mt-4 text-sm text-gray-400">This file type cannot be previewed</p>
        </div>
      </div>
    );
  };

  // Define available tabs
  const tabs: ContentTab[] = [
    {
      id: 'files',
      label: 'Files',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'config',
      label: 'Configure',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'review',
      label: 'Review',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    }
  ];

  // Update renderContent to use selectedTab
  const renderContent = () => {
    const showActionBar = selectedTab === 'files' || selectedTab === 'config';
    
    return (
      <>
        {/* Status bar with action buttons - show for both files and config tabs */}
        {showActionBar && (
          <div className="border-b border-gray-200 bg-white">
            <div className={`p-4 ${uploadStatus?.progress !== undefined ? 'pb-0' : ''}`}>
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Status section */}
                <div className="flex-grow min-w-0">
                  {copyProgress ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">
                          Copying files ({copyProgress.current}/{copyProgress.total}): {copyProgress.file}
                        </span>
                      </div>
                      <LinearProgress 
                        variant="determinate" 
                        value={(copyProgress.current / copyProgress.total) * 100} 
                        sx={{ mt: 1, height: 4, borderRadius: 2 }}
                      />
                    </>
                  ) : (
                    <>
                      {uploadStatus && (
                        <div className="flex items-center gap-2">
                          <span className={`text-base ${
                            uploadStatus.severity === 'error' ? 'text-red-600' :
                            uploadStatus.severity === 'success' ? 'text-green-600' :
                            'text-blue-600'
                          }`}>
                            {uploadStatus.message}
                          </span>
                        </div>
                      )}
                      {uploadStatus?.progress !== undefined && (
                        <LinearProgress 
                          variant="determinate" 
                          value={uploadStatus.progress} 
                          sx={{ mt: 1, height: 4, borderRadius: 2 }}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Buttons section */}
                <div className="flex gap-2 flex-shrink-0">
                  {selectedTab === 'files' ? (
                    renderActionButtons()
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTabChange('review')}
                        className="px-6 py-2 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Review & Publish
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {selectedTab === 'config' ? (
            renderConfig()
          ) : selectedTab === 'review' ? (
            <div className="h-full px-6 py-4">
              {/* Preview Section with integrated admin actions */}
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Preview</h3>
                  {/* Admin actions */}
                  <div className="flex gap-2">
                    {/* Add Chat Preview button */}
                    <button 
                      onClick={() => window.open(`#/chat/${artifactId.split('/').pop()}`, '_blank')}
                      className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Preview Chat
                    </button>
                    <button 
                      className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => setShowPublishDialog(true)}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Publish
                    </button>
                    <button 
                      className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
                
                {/* Version History */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Version History</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {artifactInfo?.versions && artifactInfo.versions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {artifactInfo.versions.map((version) => (
                          <div key={version} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                            <span className="text-sm font-medium text-gray-900">{version}</span>
                            {version === artifactInfo.version && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                current
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No versions have been published yet. Publishing this artifact will create the first version.
                      </div>
                    )}
                  </div>
                </div>

                <div className="max-w-sm mx-auto">
                  {getResourcePreview() && <ResourceCard resource={getResourcePreview()} />}
                </div>
              </div>

              {/* Comments */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Comments</h3>
                <Comments artifactId={artifactId!} />
              </div>
            </div>
          ) : selectedTab === 'chat' ? (
            renderChat()
          ) : (
            renderFileContent()
          )}
        </div>
      </>
    );
  };

  // Update the navigation button
  const renderSidebarNav = () => {
    // Get the latest content for rdf.yaml, including unsaved changes
    const getLatestRdfContent = () => {
      const rdfFile = files.find(file => file.path.endsWith('rdf.yaml'));
      if (!rdfFile) return '';
      return unsavedChanges[rdfFile.path] ?? 
        (typeof rdfFile.content === 'string' ? rdfFile.content : '');
    };

    const isRdfFile = selectedFile?.path.endsWith('rdf.yaml');
    const shouldDisableActions = isRdfFile && (!isContentValid || hasContentChanged);

    return (
      <>
        {/* Only show New Version button if not in staging mode */}
        {!isStaged && (
          <div className="p-4 border-b bg-white space-y-2">
            <button
              onClick={() => setShowNewVersionDialog(true)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-white text-gray-700 border hover:bg-gray-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Version
            </button>
          </div>
        )}
        {/* Navigation buttons section */}
        <div className="p-4 border-b bg-white space-y-2">
          <button
            onClick={() => handleTabChange('config')}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${selectedTab === 'config' 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-white text-gray-700 border hover:bg-gray-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure Agent
          </button>
          <button
            onClick={() => handleTabChange('chat')}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${selectedTab === 'chat' 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-white text-gray-700 border hover:bg-gray-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Start Chat
          </button>
          {/* Add Review & Publish button only when in staging mode */}
          {isStaged && (
            <button
              onClick={() => handleTabChange('review')}
              disabled={shouldDisableActions}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${shouldDisableActions
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : selectedTab === 'review'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-gray-700 border hover:bg-gray-50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Review & Publish
            </button>
          )}
        </div>
      </>
    );
  };

  // Update the publish confirmation dialog
  const renderPublishDialog = () => (
    <MuiDialog 
      open={showPublishDialog} 
      onClose={() => setShowPublishDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Confirm Publication
        </h3>
        <div className="space-y-6">
          <div className="text-sm text-gray-500 space-y-4">
            <p>
              You are about to publish this artifact to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li>The {SITE_NAME}</li>
              <li>Telecom industry standards and protocols</li>
              <li>Network architecture and operations</li>
              <li>Customer service best practices</li>
            </ul>
            <p className="text-red-600 font-medium">
              ⚠️ Warning: This action cannot be undone. Once published, the artifact cannot be withdrawn from either platform.
            </p>
          </div>

          {/* Version and Comment fields */}
          <div className="space-y-4">
            <div>
              <TextField
                label="Version (optional)"
                value={publishData.version}
                onChange={(e) => setPublishData(prev => ({ ...prev, version: e.target.value }))}
                fullWidth
                size="small"
                helperText="Leave empty to auto-increment the latest version"
              />
              <div className="mt-2">
                <span className="text-xs text-gray-500">Existing versions: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {artifactInfo?.versions && artifactInfo.versions.length > 0 ? (
                    artifactInfo.versions.map((v) => (
                      <span key={v} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {v}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500 italic">No versions published yet</span>
                  )}
                </div>
              </div>
            </div>
            <TextField
              label="Comment"
              value={publishData.comment}
              onChange={(e) => setPublishData(prev => ({ ...prev, comment: e.target.value }))}
              required
              fullWidth
              multiline
              rows={3}
              size="small"
              helperText="Describe the changes in this publication"
              error={!publishData.comment.trim()}
            />
          </div>
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={() => setShowPublishDialog(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={!publishData.comment.trim()}
            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              ${!publishData.comment.trim() 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Confirm & Publish
          </button>
        </div>
      </div>
    </MuiDialog>
  );

  // Update URL when tab changes
  const handleTabChange = (tab: 'files' | 'review' | 'config' | 'chat', filePath?: string) => {
    setSelectedTab(tab);
    if (tab === 'files' && filePath) {
      setSearchParams({ tab: `@${filePath}` });
    } else {
      setSearchParams({ tab });
    }
  };

  // Update the effect to handle @ prefix in URL
  useEffect(() => {
    if (artifactId && files.length > 0) {
      const tabParam = searchParams.get('tab');
      
      if (tabParam?.startsWith('@')) {
        // Extract file path from tab parameter
        const filePath = tabParam.substring(1);
        const fileToSelect = files.find(f => f.path === filePath);
        
        if (fileToSelect) {
          setSelectedTab('files');
          handleFileSelect(fileToSelect);
        }
      } else {
        // If no tab is specified in URL, set it to 'config'
        const tab = tabParam as 'files' | 'review' | 'config' | 'chat' || 'config';
        setSelectedTab(tab);
        if (!tabParam) {
          setSearchParams({ tab: 'config' });
        }
        
        // Only auto-select rdf.yaml if we're in files tab
        if (tab === 'files' && !selectedFile) {
          const rdfFile = files.find(file => file.path.endsWith('rdf.yaml'));
          if (rdfFile) {
            handleFileSelect(rdfFile);
          }
        }
      }
    }
  }, [artifactId, files, searchParams]); // Remove selectedFile from dependencies

  // Add this effect to handle tab state when staged status changes
  useEffect(() => {
    if (!isStaged && selectedTab === 'review') {
      handleTabChange('files');
    }
  }, [isStaged]);

  // Add file upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!artifactManager || !artifactId) return;

    for (const file of acceptedFiles) {
      try {
        setUploadStatus({
          message: `Uploading ${file.name}...`,
          severity: 'info'
        });

        // Get presigned URL for upload
        const presignedUrl = await artifactManager.put_file({
          artifact_id: artifactId,
          file_path: file.name,
          _rkwargs: true
        });

        // Upload file content
        const response = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': '' // important for s3
          }
        });

        if (!response.ok) {
          throw new Error('Failed to upload file');
        }

        // Add file to local state
        const content = await file.text();
        const newFile: FileNode = {
          name: file.name,
          path: file.name,
          content,
          isDirectory: false,
          edited: true
        };

        setFiles(prev => [...prev, newFile]);
        setSelectedFile(newFile);

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
      }
    }
  }, [artifactId, artifactManager]);

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop,
    noClick: true,
    noKeyboard: true
  });

  const handleDeleteFile = async (file: FileNode) => {
    if (!artifactManager || !artifactId) return;

    try {
      setUploadStatus({
        message: `Deleting ${file.name}...`,
        severity: 'info'
      });

      await artifactManager.remove_file({
        artifact_id: artifactId,
        file_path: file.path,
        _rkwargs: true
      });

      // Clear selected file if it was the deleted one
      if (selectedFile?.path === file.path) {
        setSelectedFile(null);
        setImageUrl(null);
        // Clear any unsaved changes for this file
        setUnsavedChanges(prev => {
          const newState = { ...prev };
          delete newState[file.path];
          return newState;
        });
      }

      // Refresh the file list from the server instead of just updating local state
      await loadArtifactFiles();

      setUploadStatus({
        message: `${file.name} deleted successfully`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      setUploadStatus({
        message: `Error deleting ${file.name}`,
        severity: 'error'
      });
    }
    setShowDeleteConfirm(null);
  };

  // Update renderFileList to include file management features
  const renderFileList = () => (
    <div {...getRootProps()} className="flex-1 overflow-y-auto overflow-x-hidden"> {/* Added overflow-x-hidden */}
      {/* Add Files section with + File button */}
      <div className="mt-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <h3 className="text-sm font-medium text-gray-700">Files</h3>
          {isStaged && (
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
              />
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </label>
          )}
        </div>
      </div>
      <div className="py-2">
        {files.map((file) => (
          <div
            key={file.path}
            className="group relative"
          >
            <div
              onClick={() => handleFileSelect(file)}
              className={`cursor-pointer px-4 py-2.5 hover:bg-gray-100 transition-colors flex items-center gap-3
                ${selectedFile?.path === file.path ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
            >
              {/* File Icon */}
              <span className="flex-shrink-0">
                {file.name.endsWith('.yaml') || file.name.endsWith('.yml') ? (
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ) : file.name.match(/\.(png|jpg|jpeg|gif)$/i) ? (
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
              </span>

              <div className="flex items-center gap-2 flex-1">
                <span className="truncate text-sm font-medium tracking-wide">
                  {file.name}
                </span>
                {file.edited && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-medium">
                    edited
                  </span>
                )}
              </div>

              {/* Delete button - only show for staged artifacts */}
              {isStaged && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(file.path);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                >
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Add this handler function near other handlers
  const handleValidationComplete = (result: ValidationResult) => {
    setUploadStatus({
      message: result.success ? 'Validation successful!' : 'Validation failed',
      severity: result.success ? 'success' : 'error'
    });
    
    setIsContentValid(result.success);
    setHasContentChanged(false);
  };

  // Update the renderActionButtons function
  const renderActionButtons = () => {
    // Get the latest content for rdf.yaml, including unsaved changes
    const getLatestRdfContent = () => {
      const rdfFile = files.find(file => file.path.endsWith('rdf.yaml'));
      if (!rdfFile) return '';
      return unsavedChanges[rdfFile.path] ?? 
        (typeof rdfFile.content === 'string' ? rdfFile.content : '');
    };

    const isRdfFile = selectedFile?.path.endsWith('rdf.yaml');
    const shouldDisableActions = isRdfFile && (!isContentValid || hasContentChanged);

    return (
      <div className="flex gap-2">
        {selectedFile && isTextFile(selectedFile.name) && (
          <button
            onClick={() => handleSave(selectedFile)}
            disabled={!unsavedChanges[selectedFile.path] || 
                     uploadStatus?.severity === 'info' || 
                     (isRdfFile && !isContentValid)}
            title={`Save (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+S)`}
            className={`px-6 py-2 rounded-md font-medium transition-colors whitespace-nowrap flex items-center gap-2
              ${!unsavedChanges[selectedFile.path] || 
                uploadStatus?.severity === 'info' || 
                (isRdfFile && !isContentValid)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-300'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
        )}

        {isRdfFile && (
          <div title={`Run Validator (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+R)`}>
            <ModelValidator
              rdfContent={getLatestRdfContent()}
              isDisabled={!server}
              onValidationComplete={handleValidationComplete}
              data-testid="model-validator-button"
            />
          </div>
        )}

        {artifactId && (
          <ModelTester
            artifactId={artifactId}
            version={isStaged ? 'stage' : artifactInfo?.version}
            isDisabled={!isStaged || shouldDisableActions}
          />
        )}
      </div>
    );
  };

  // Add delete confirmation dialog
  const renderDeleteConfirmDialog = () => (
    showDeleteConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Delete File
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete "{files.find(f => f.path === showDeleteConfirm)?.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const file = files.find(f => f.path === showDeleteConfirm);
                if (file) handleDeleteFile(file);
              }}
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  );

  const handleDeleteArtifact = async () => {
    if (!artifactManager || !artifactId || !artifactInfo) return;

    try {
      setIsDeleting(true);
      
      // Delete the artifact with the correct version parameter
      await artifactManager.delete({
        artifact_id: artifactId,
        // Only use "stage" if there are published versions, otherwise null
        version: artifactInfo.versions && artifactInfo.versions.length > 0 ? "stage" : null,
        delete_files: true,
        recursive: true,
        _rkwargs: true
      });
      
      // Navigate back to My Agents after successful deletion
      navigate('/my-agents');
    } catch (err) {
      console.error('Error deleting artifact:', err);
      setUploadStatus({
        message: 'Failed to delete artifact',
        severity: 'error'
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Add this function to render the delete dialog
  const renderDeleteDialog = () => (
    <Transition.Root show={isDeleteDialogOpen} as={Fragment}>
      <HeadlessDialog as="div" className="relative z-10" onClose={setIsDeleteDialogOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <HeadlessDialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <HeadlessDialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Delete
                    </HeadlessDialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete all staged changes? This will remove all unpublished changes, but won't affect the published version. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                    onClick={handleDeleteArtifact}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={() => setIsDeleteDialogOpen(false)}
                  >
                    Keep Changes
                  </button>
                </div>
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition.Root>
  );

  // Add function to handle new version creation
  const handleCreateNewVersion = async () => {
    try {
      setUploadStatus({
        message: 'Creating new version...',
        severity: 'info'
      });
      // Create new version via edit
      const artifact = await artifactManager.edit({
        artifact_id: artifactId,
        version: "stage",
        _rkwargs: true
      });
      console.log(artifact);

      if (newVersionData.copyFiles) {
        // Get list of existing files
        const existingFiles = await artifactManager.list_files({
          artifact_id: artifactId,
          version: "latest",
          _rkwargs: true
        });
        // Filter out directories, only keep files
        const filesToCopy = existingFiles.filter((file: FileListItem) => file.type === 'file');

        // Set up progress tracking
        setCopyProgress({
          current: 0,
          total: filesToCopy.length,
          file: ''
        });

        // Copy files one by one
        for (let i = 0; i < filesToCopy.length; i++) {
          const file = filesToCopy[i];
          setCopyProgress({
            current: i + 1,
            total: filesToCopy.length,
            file: file.name
          });

          try {
            // Get download URL for the file
            const downloadUrl = await artifactManager.get_file({
              artifact_id: artifactId,
              file_path: file.name,
              _rkwargs: true
            });

            // Get upload URL for the new version
            const uploadUrl = await artifactManager.put_file({
              artifact_id: artifactId,
              file_path: file.name,
              _rkwargs: true
            });

            // Download and upload the file
            const response = await fetch(downloadUrl);
            if (!response.ok) {
              throw new Error(`Failed to download file: ${file.name}`);
            }
            const blob = await response.blob();
            
            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: blob
            });
            
            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload file: ${file.name}`);
            }
          } catch (error) {
            console.error(`Error copying file ${file.name}:`, error);
            setUploadStatus({
              message: `Error copying file ${file.name}`,
              severity: 'error'
            });
            // Continue with next file instead of stopping completely
            continue;
          }
        }
        
        setCopyProgress(null);
      }

      // Only close dialog and reload after all operations are complete
      setShowNewVersionDialog(false);
      
      // Reload artifact files
      await loadArtifactFiles();
      
      setUploadStatus({
        message: 'New version created successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error creating new version:', error);
      setUploadStatus({
        message: 'Error creating new version',
        severity: 'error'
      });
    }
  };

  // Add new version dialog component
  const renderNewVersionDialog = () => (
    <MuiDialog 
      open={showNewVersionDialog} 
      onClose={() => setShowNewVersionDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Create New Version
        </h3>
        <div className="space-y-4">
          <FormControlLabel
            control={
              <Checkbox
                checked={newVersionData.copyFiles}
                onChange={(e) => setNewVersionData(prev => ({ ...prev, copyFiles: e.target.checked }))}
              />
            }
            label="Copy existing files to new version"
          />
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={() => setShowNewVersionDialog(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateNewVersion}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>
    </MuiDialog>
  );

  // Add this function inside the Edit component, before the return statement
  const setupKeyboardShortcuts = useCallback(() => {
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 's',
        ctrlKey: true,
        metaKey: true, // for Mac
        handler: (e: KeyboardEvent) => {
          e.preventDefault();
          if (selectedFile && isTextFile(selectedFile.name)) {
            handleSave(selectedFile);
          }
        }
      },
      {
        key: 'r',
        ctrlKey: true,
        metaKey: true, // for Mac
        handler: (e: KeyboardEvent) => {
          e.preventDefault();
          if (selectedFile?.path.endsWith('rdf.yaml')) {
            // Get latest content including unsaved changes
            const rdfFile = files.find(file => file.path.endsWith('rdf.yaml'));
            if (!rdfFile) return;
            
            // Trigger validation via button click
            const validator = document.querySelector('[data-testid="model-validator-button"]');
            if (validator instanceof HTMLButtonElement) {
              validator.click();
            }
          }
        }
      }
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        if (
          e.key.toLowerCase() === shortcut.key &&
          (!shortcut.ctrlKey || e.ctrlKey) &&
          (!shortcut.metaKey || e.metaKey)
        ) {
          shortcut.handler(e);
        }
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, handleSave, unsavedChanges, files]); // Add other dependencies as needed

  // Add this useEffect to set up the keyboard shortcuts
  useEffect(() => {
    const cleanup = setupKeyboardShortcuts();
    return cleanup;
  }, [setupKeyboardShortcuts]);

  // Add function to load extensions
  const loadExtensions = async () => {
    if (!schemaAgents) return;
    
    try {
      
      if (schemaAgents.extensions) {
        setAvailableExtensions(schemaAgents.extensions);
      }
    } catch (error) {
      console.error("Error loading extensions:", error);
    }
  };

  // Add useEffect to load extensions and initial config
  useEffect(() => {
    if (schemaAgents) {
      loadExtensions();
    }
  }, [schemaAgents]);

  useEffect(() => {
    if (artifactInfo?.manifest) {
      setAgentConfig({
        // Basic Info
        name: artifactInfo.manifest.name || '',
        description: artifactInfo.manifest.description || '',
        welcomeMessage: artifactInfo.manifest.welcomeMessage || 'Hello, how can I assist you today?',
        
        // Runtime Configuration
        agent_config: {
          // Identity
          name: artifactInfo.manifest.name || '',
          profile: artifactInfo.manifest.agent_config?.profile || 'AI Assistant',
          goal: artifactInfo.manifest.agent_config?.goal || 'I am a helpful AI assistant',
          
          // Model Settings
          model: artifactInfo.manifest.agent_config?.model || 'gpt-4o-mini',
          stream: artifactInfo.manifest.agent_config?.stream ?? true,
          instructions: artifactInfo.manifest.description || ''
        }
      });
    }
  }, [artifactInfo]);

  // Add function to save agent config
  const handleSaveConfig = async () => {
    if (!artifactManager || !artifactId || !artifactInfo?.manifest) return;

    try {
      setUploadStatus({
        message: 'Saving configuration...',
        severity: 'info'
      });

      const updatedManifest = {
        ...artifactInfo.manifest,
        // Basic Info
        name: agentConfig.name,
        description: agentConfig.description,
        welcomeMessage: agentConfig.welcomeMessage,
        
        // Runtime Configuration
        agent_config: {
          // Identity
          name: agentConfig.name,
          profile: agentConfig.agent_config.profile,
          goal: agentConfig.agent_config.goal,
          
          // Model Settings
          model: agentConfig.agent_config.model,
          stream: agentConfig.agent_config.stream,
          instructions: agentConfig.description,

          // Voice Settings
          voice: agentConfig.agent_config.voice,
          temperature: agentConfig.agent_config.temperature,
          max_output_tokens: agentConfig.agent_config.max_output_tokens,

          // Tools Configuration
          enabled_tools: agentConfig.agent_config.enabled_tools
        }
      };

      await artifactManager.edit({
        artifact_id: artifactId,
        manifest: updatedManifest,
        version: "stage",
        _rkwargs: true
      });

      setUploadStatus({
        message: 'Configuration saved successfully',
        severity: 'success'
      });

      await loadArtifactFiles();
    } catch (error) {
      console.error('Error saving configuration:', error);
      setUploadStatus({
        message: 'Error saving configuration',
        severity: 'error'
      });
    }
  };

  // Update renderConfig to merge the two sections
  const renderConfig = () => (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Agent Configuration</h2>
        
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <TextField
              label="Agent Name"
              value={agentConfig.name}
              onChange={(e) => setAgentConfig(prev => ({
                ...prev,
                name: e.target.value,
                agent_config: {
                  ...prev.agent_config,
                  name: e.target.value
                }
              }))}
              fullWidth
              required
            />

            <TextField
              label="Description"
              value={agentConfig.description}
              onChange={(e) => setAgentConfig(prev => ({
                ...prev,
                description: e.target.value,
                agent_config: {
                  ...prev.agent_config,
                  instructions: e.target.value
                }
              }))}
              fullWidth
              required
              helperText="Describe the agent's purpose and behavior"
            />

            <TextField
              label="Welcome Message"
              value={agentConfig.welcomeMessage}
              onChange={(e) => setAgentConfig(prev => ({
                ...prev,
                welcomeMessage: e.target.value
              }))}
              fullWidth
              helperText="Message displayed when starting a conversation with the agent"
            />
          </div>

          {/* Runtime Configuration */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Runtime Configuration</h3>
            
            {/* Identity */}
            <div className="space-y-4 mb-6">
              <TextField
                label="Profile"
                value={agentConfig.agent_config.profile}
                onChange={(e) => setAgentConfig(prev => ({
                  ...prev,
                  agent_config: {
                    ...prev.agent_config,
                    profile: e.target.value
                  }
                }))}
                fullWidth
                required
                helperText="Define the agent's role and expertise"
              />

              <TextField
                label="Goal"
                value={agentConfig.agent_config.goal}
                onChange={(e) => setAgentConfig(prev => ({
                  ...prev,
                  agent_config: {
                    ...prev.agent_config,
                    goal: e.target.value
                  }
                }))}
                fullWidth
                required
                multiline
                rows={4}
                helperText="Define the agent's primary objective and expected behavior in detail"
              />
            </div>

            {/* Model Settings */}
            <div className="space-y-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900">Model Settings</h4>
              
              <TextField
                label="Model"
                value={agentConfig.agent_config.model}
                onChange={(e) => setAgentConfig(prev => ({
                  ...prev,
                  agent_config: {
                    ...prev.agent_config,
                    model: e.target.value
                  }
                }))}
                fullWidth
                required
                helperText="Specify the LLM model to use"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={agentConfig.agent_config.stream}
                    onChange={(e) => setAgentConfig(prev => ({
                      ...prev,
                      agent_config: {
                        ...prev.agent_config,
                        stream: e.target.checked
                      }
                    }))}
                  />
                }
                label="Enable streaming responses"
              />
            </div>

            {/* Voice Settings */}
            <div className="space-y-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900">Voice Settings</h4>
              
              <FormControl fullWidth>
                <InputLabel>Voice</InputLabel>
                <Select
                  value={agentConfig.agent_config.voice || "sage"}
                  onChange={(e) => setAgentConfig(prev => ({
                    ...prev,
                    agent_config: {
                      ...prev.agent_config,
                      voice: e.target.value
                    }
                  }))}
                >
                  {VOICE_OPTIONS.map((voice) => (
                    <MenuItem key={voice} value={voice}>
                      {voice.charAt(0).toUpperCase() + voice.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Temperature"
                type="number"
                value={agentConfig.agent_config.temperature || 0.8}
                onChange={(e) => setAgentConfig(prev => ({
                  ...prev,
                  agent_config: {
                    ...prev.agent_config,
                    temperature: parseFloat(e.target.value)
                  }
                }))}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                fullWidth
                helperText="Controls randomness in responses (0.0 to 1.0)"
              />

              <TextField
                label="Max Output Tokens"
                type="number"
                value={agentConfig.agent_config.max_output_tokens || 1024}
                onChange={(e) => setAgentConfig(prev => ({
                  ...prev,
                  agent_config: {
                    ...prev.agent_config,
                    max_output_tokens: parseInt(e.target.value)
                  }
                }))}
                inputProps={{ min: 1, step: 1 }}
                fullWidth
                helperText="Maximum length of generated responses"
              />
            </div>

            {/* Tools Configuration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Enabled Tools</h4>
              
              <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[3rem]">
                {(agentConfig.agent_config.enabled_tools || ['code_interpreter']).map((toolId) => {
                  const tool = availableTools.find(t => t.id === toolId);
                  if (!tool) return null;
                  
                  return (
                    <Chip
                      key={tool.id}
                      label={tool.name}
                      onDelete={() => setAgentConfig(prev => ({
                        ...prev,
                        agent_config: {
                          ...prev.agent_config,
                          enabled_tools: prev.agent_config.enabled_tools?.filter(id => id !== tool.id)
                        }
                      }))}
                      className="m-1"
                    />
                  );
                })}
              </div>

              <FormControl fullWidth>
                <InputLabel>Add Tool</InputLabel>
                <Select
                  value=""
                  onChange={(e) => {
                    const toolId = e.target.value;
                    setAgentConfig(prev => ({
                      ...prev,
                      agent_config: {
                        ...prev.agent_config,
                        enabled_tools: [...(prev.agent_config.enabled_tools || []), toolId]
                      }
                    }));
                  }}
                >
                  {availableTools
                    .filter(tool => !(agentConfig.agent_config.enabled_tools || []).includes(tool.id))
                    .map(tool => (
                      <MenuItem key={tool.id} value={tool.id}>
                        <div>
                          <div className="font-medium">{tool.name}</div>
                          <div className="text-sm text-gray-500">{tool.description}</div>
                        </div>
                      </MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Update renderChat function
  const renderChat = () => (
    <div className="flex-1 flex flex-col" style={{ height: 'calc(100vh - 107px)' }}> {/* 104px = 64px (navbar) + 40px (back button bar) */}
      {selectedTab === 'chat' && (
        <LazyThebeProvider>
          <Chat 
            agentConfig={{
              ...agentConfig.agent_config,
            }}
            className="flex-1"
            showActions={true}
            onPreviewChat={() => artifactId && window.open(`#/chat/${artifactId.split('/').pop()}`, '_blank')}
            onPublish={() => setShowPublishDialog(true)}
            artifactId={artifactId}
          />
        </LazyThebeProvider>
      )}
      {selectedTab !== 'chat' && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select the chat tab to start a conversation
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Update back button */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to My Agents
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* File sidebar */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">

          {/* Artifact Info Box - always visible */}
          <div className="border-t border-gray-200 bg-white p-4 space-y-2">
            {artifactInfo ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{artifactInfo.name}</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {artifactInfo.version === 'stage' ? 'stage' : `v${artifactInfo.version || '1.0'}`}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-mono mt-2">
                  ID: {artifactInfo.id.split("/").pop()}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">Loading artifact info...</div>
            )}
          </div>
          {/* Navigation buttons */}
          {renderSidebarNav()}

          {/* Files list - always visible */}
          {renderFileList()}

        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0">
          {renderContent()}
        </div>
      </div>

      {/* Publish Confirmation Dialog */}
      {renderPublishDialog()}

      {renderDeleteConfirmDialog()}

      {renderDeleteDialog()}

      {renderNewVersionDialog()}
    </div>
  );
};

export default Edit; 