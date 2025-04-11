import React, { useEffect, useMemo, useState } from 'react';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, TreeItem as RCTTreeItem, TreeItemIndex } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { ProjectFile } from '../../providers/ProjectsProvider';
import { FaTrash } from 'react-icons/fa';
import { useProjects } from '../../providers/ProjectsProvider';
import ConfirmDialog from '../common/ConfirmDialog';

interface ProjectFileTreeProps {
  files: ProjectFile[];
  onSelectFile: (file: ProjectFile) => Promise<void>;
}

interface TreeItem extends RCTTreeItem<string> {
  path: string;
  isLoaded: boolean;
  children: string[];
}

const ProjectFileTree: React.FC<ProjectFileTreeProps> = ({ files, onSelectFile }) => {
  const { selectedProject, deleteFile, getProjectFiles } = useProjects();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  // Initialize tree items with proper structure
  const [treeItems, setTreeItems] = useState<Record<string, TreeItem>>({
    root: {
      index: 'root',
      canMove: false,
      isFolder: true,
      children: [],
      data: 'Files',
      canRename: false,
      isLoaded: false,
      path: '',
    },
  });

  // Reset and initialize tree when files change
  useEffect(() => {
    console.info('[ProjectFileTree] Updating tree with files:', files.length);
    
    // Start fresh with just the root
    const newItems: Record<string, TreeItem> = {
      root: {
        index: 'root',
        canMove: false,
        isFolder: true,
        children: [],
        data: 'Files',
        canRename: false,
        isLoaded: false,
        path: '',
      },
    };

    // Get root level files
    const rootFiles = files.filter(file => !file.path.includes('/'));
    console.info('[ProjectFileTree] Root level files:', rootFiles.length);
    
    // Add root level files to tree
    rootFiles.forEach(file => {
      newItems[file.path] = {
        index: file.path,
        canMove: false,
        isFolder: file.type === 'directory',
        children: [],
        data: file.name,
        canRename: false,
        path: file.path,
        isLoaded: file.type !== 'directory',
      };
      newItems.root.children.push(file.path);
    });
    
    newItems.root.isLoaded = true;
    console.info('[ProjectFileTree] Setting tree items with children:', newItems.root.children.length);
    setTreeItems(newItems);
  }, [files]);

  // Add effect to log tree items changes
  useEffect(() => {
    console.info('[ProjectFileTree] Tree items updated:', Object.keys(treeItems).length - 1); // -1 for root
    console.info('[ProjectFileTree] Current tree items:', treeItems);
  }, [treeItems]);

  // Handle expanding a directory
  const handleExpandItem = async (item: RCTTreeItem<string>, treeId: string) => {
    const treeItem = item as TreeItem;
    const itemId = treeItem.index;
    if (!itemId || itemId === 'root' || !treeItem.isFolder || treeItem.isLoaded) return;

    // Get all files that are direct children of this directory
    const dirPath = treeItem.path;
    const childFiles = files.filter(file => {
      const relativePath = file.path.substring(dirPath.length + 1);
      return file.path.startsWith(dirPath + '/') && !relativePath.includes('/');
    });

    // Update tree items with the new children
    setTreeItems(prevItems => {
      const newItems = { ...prevItems };
      
      // Add each child file/directory
      childFiles.forEach(file => {
        newItems[file.path] = {
          index: file.path,
          canMove: false,
          isFolder: file.type === 'directory',
          children: [],
          data: file.name,
          canRename: false,
          path: file.path,
          isLoaded: file.type !== 'directory',
        };
      });

      // Update parent's children list
      newItems[itemId] = {
        ...newItems[itemId],
        children: childFiles.map(f => f.path),
        isLoaded: true
      };

      return newItems;
    });
  };

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

  // Create data provider with proper rename handler
  const dataProvider = useMemo(() => {
    return new StaticTreeDataProvider(treeItems, (item, data) => ({ ...item, data }));
  }, [treeItems]);

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
      // Refresh the file list
      const updatedFiles = await getProjectFiles(selectedProject.id);
      // Reset tree items with updated files
      const newItems: Record<string, TreeItem> = {
        root: {
          index: 'root',
          canMove: false,
          isFolder: true,
          children: [],
          data: 'Files',
          canRename: false,
          isLoaded: false,
          path: '',
        },
      };

      const rootFiles = updatedFiles.filter(file => !file.path.includes('/'));
      rootFiles.forEach(file => {
        newItems[file.path] = {
          index: file.path,
          canMove: false,
          isFolder: file.type === 'directory',
          children: [],
          data: file.name,
          canRename: false,
          path: file.path,
          isLoaded: file.type !== 'directory',
        };
        newItems.root.children.push(file.path);
      });
      
      newItems.root.isLoaded = true;
      setTreeItems(newItems);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  return (
    <div className="h-full min-h-[50px] flex flex-col bg-white">
      <style>
        {`
          .rct-tree-item-title {
            padding: 4px 8px;
            border-radius: 4px;
          }
          .rct-tree-item-title:hover {
            background-color: #f3f4f6;
          }
          .rct-tree-item-arrow {
            margin-right: 4px;
          }
        `}
      </style>
      <UncontrolledTreeEnvironment
        dataProvider={dataProvider}
        getItemTitle={item => item.data}
        viewState={{
          'project-files': {
            expandedItems: ['root'],
            selectedItems: []
          }
        }}
        canDragAndDrop={false}
        canDropOnFolder={false}
        canReorderItems={false}
        onSelectItems={handleSelect}
        onExpandItem={handleExpandItem}
        renderItemTitle={({ item, title }) => {
          const treeItem = item as TreeItem;
          return (
            <div className="flex items-center justify-between w-full pr-2 group">
              <span>{title}</span>
              {!treeItem.isFolder && treeItem.path !== 'root' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(treeItem.path);
                  }}
                  className="p-1 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete file"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        }}
        renderItemArrow={({ item }) => {
          const treeItem = item as TreeItem;
          return treeItem.isFolder ? (
            <span className="w-6 text-gray-400">
              {treeItem.children.length > 0 && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </span>
          ) : null;
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