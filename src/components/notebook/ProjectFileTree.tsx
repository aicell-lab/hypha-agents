import React, { useEffect, useMemo, useState } from 'react';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, TreeItem as RCTTreeItem, TreeItemIndex } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { ProjectFile } from '../../providers/ProjectsProvider';
import { FaTrash, FaFolder, FaFolderOpen, FaFile, FaCode, FaImage, FaFileAlt } from 'react-icons/fa';
import { useProjects } from '../../providers/ProjectsProvider';
import ConfirmDialog from '../common/ConfirmDialog';

interface ProjectFileTreeProps {
  files: ProjectFile[];
  onSelectFile: (file: ProjectFile) => Promise<void>;
}

interface TreeItem extends Omit<RCTTreeItem<string>, 'children'> {
  path: string;
  isLoaded: boolean;
  children: string[];
}

const getFileIcon = (filename: string, isFolder: boolean, isOpen: boolean) => {
  if (isFolder) {
    return isOpen ? <FaFolderOpen className="w-4 h-4 text-yellow-500" /> : <FaFolder className="w-4 h-4 text-yellow-500" />;
  }
  
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'py':
    case 'json':
      return <FaCode className="w-4 h-4 text-blue-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <FaImage className="w-4 h-4 text-purple-500" />;
    case 'md':
    case 'txt':
    case 'log':
    case 'yml':
    case 'yaml':
      return <FaFileAlt className="w-4 h-4 text-gray-500" />;
    default:
      return <FaFile className="w-4 h-4 text-gray-400" />;
  }
};

const ProjectFileTree: React.FC<ProjectFileTreeProps> = ({ files, onSelectFile }) => {
  const { selectedProject, deleteFile, getProjectFiles } = useProjects();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>(['root']);

  // Convert files to tree items format
  const treeItems = useMemo(() => {
    console.info('[ProjectFileTree] Building tree items from files:', files);
    
    const items: Record<string, TreeItem> = {
      root: {
        index: 'root',
        isFolder: true,
        children: [],
        data: 'Files',
        path: '',
        isLoaded: true,
      }
    };

    if (!files || files.length === 0) {
      console.info('[ProjectFileTree] No files to process');
      return items;
    }

    // First pass: create all file/directory nodes
    files.forEach(file => {
      items[file.path] = {
        index: file.path,
        isFolder: file.type === 'directory',
        children: [],
        data: file.name,
        path: file.path,
        isLoaded: true,
      };
    });

    // Second pass: build parent-child relationships
    files.forEach(file => {
      const pathParts = file.path.split('/');
      if (pathParts.length === 1) {
        // Root level file
        items.root.children.push(file.path);
      } else {
        // Get parent path and add to parent's children
        const parentPath = pathParts.slice(0, -1).join('/');
        if (items[parentPath]) {
          items[parentPath].children.push(file.path);
        } else {
          // If parent doesn't exist, add to root
          items.root.children.push(file.path);
        }
      }
    });

    console.info('[ProjectFileTree] Built tree items:', {
      itemCount: Object.keys(items).length,
      rootChildren: items.root.children
    });
    return items;
  }, [files]);

  // Create data provider
  const dataProvider = useMemo(() => {
    return new StaticTreeDataProvider(treeItems, (item, data) => ({ ...item, data }));
  }, [treeItems]);

  // Handle selecting a file
  const handleSelect = (items: TreeItemIndex[], treeId: string) => {
    if (!items.length) return;
    
    const selectedPath = items[0].toString();
    const treeItem = treeItems[selectedPath];
    
    // Only handle selection of files, not directories
    if (treeItem && !treeItem.isFolder) {
      const selectedFile = files.find(f => f.path === selectedPath);
      if (selectedFile) {
        onSelectFile(selectedFile).catch(console.error);
      }
    }
  };

  // Handle expanding items
  const handleExpand = (item: RCTTreeItem<string>, treeId: string) => {
    setExpandedItems(prev => [...prev, item.index as string]);
  };

  const handleCollapse = (item: RCTTreeItem<string>, treeId: string) => {
    setExpandedItems(prev => prev.filter(i => i !== item.index));
  };

  // Handle file deletion
  const handleDeleteFile = async (filePath: string) => {
    if (!selectedProject) return;
    setFileToDelete(filePath);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedProject || !fileToDelete) return;

    try {
      await deleteFile(selectedProject.id, fileToDelete);
      await getProjectFiles(selectedProject.id);
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    }
  };

  return (
    <div className="h-full min-h-[50px] flex flex-col bg-white">
      <style>
        {`
          :root {
            --rct-color-tree-bg: transparent;
            --rct-item-height: 28px;
            --rct-color-search-highlight-bg: #acccf1;
            --rct-color-tree-focus-outline: transparent;
            --rct-item-margin: 1px;
            --rct-item-padding: 8px;
            --rct-radius: 4px;
            --rct-bar-offset: 6px;
            --rct-bar-width: 4px;
            --rct-bar-color: #2563eb;
            --rct-focus-outline: #2563eb;
            --rct-color-focustree-item-selected-bg: #e0e7ff;
            --rct-color-focustree-item-hover-bg: #f3f4f6;
            --rct-color-focustree-item-hover-text: inherit;
            --rct-color-focustree-item-active-bg: #dbeafe;
            --rct-color-focustree-item-active-text: #1e40af;
            --rct-arrow-size: 10px;
            --rct-arrow-container-size: 16px;
            --rct-arrow-padding: 6px;
            --rct-cursor: pointer;
          }

          .rct-tree-item-button {
            padding: 4px 8px;
            border-radius: var(--rct-radius);
            transition: all 0.2s ease;
          }

          .rct-tree-item-button:hover {
            background-color: var(--rct-color-focustree-item-hover-bg);
          }

          .rct-tree-item-title {
            font-size: 0.875rem;
            line-height: 1.25rem;
          }

          .rct-tree-item-arrow {
            color: #6b7280;
            transition: transform 0.15s ease;
          }

          .rct-tree-item-arrow-expanded {
            transform: rotate(90deg);
          }
        `}
      </style>
      <UncontrolledTreeEnvironment
        dataProvider={dataProvider}
        getItemTitle={item => item.data}
        viewState={{
          'project-files': {
            expandedItems,
            selectedItems: []
          }
        }}
        canDragAndDrop={false}
        canDropOnFolder={false}
        canReorderItems={false}
        onSelectItems={handleSelect}
        onExpandItem={handleExpand}
        onCollapseItem={handleCollapse}
        renderItemTitle={({ item, title, context }) => {
          const treeItem = item as TreeItem;
          const isExpanded = expandedItems.includes(String(treeItem.index));
          const isFolder = Boolean(treeItem.isFolder);
          return (
            <div className="flex items-center justify-between w-full group min-w-0 gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(String(treeItem.data), isFolder, isExpanded)}
                <div className="truncate">{title}</div>
              </div>
              {!isFolder && treeItem.path !== 'root' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(treeItem.path);
                  }}
                  className="p-1 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Delete file"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        }}
      >
        <div className="flex-1 overflow-auto h-full">
          <Tree
            treeId="project-files"
            rootItem="root"
            treeLabel="Project Files"
          />
        </div>
      </UncontrolledTreeEnvironment>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setFileToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete File"
        message="Are you sure you want to delete this file? This action cannot be undone."
      />
    </div>
  );
};

export default ProjectFileTree; 