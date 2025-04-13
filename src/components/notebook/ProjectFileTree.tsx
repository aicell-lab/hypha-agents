import React, { useEffect, useMemo, useState } from 'react';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, TreeItem as RCTTreeItem, TreeItemIndex, TreeItemRenderContext, TreeInformation } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { ProjectFile } from '../../providers/ProjectsProvider';
import { FaTrash, FaFolder, FaFolderOpen, FaFile, FaCode, FaImage, FaFileAlt } from 'react-icons/fa';
import { useProjects } from '../../providers/ProjectsProvider';
import ConfirmDialog from '../common/ConfirmDialog';

interface ProjectFileTreeProps {
  files: ProjectFile[];
  onSelectFile: (file: ProjectFile) => Promise<void>;
  onDoubleClickFile: (file: ProjectFile) => Promise<void>;
  onRefreshInBrowserFiles?: () => Promise<void>;
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

const ProjectFileTree: React.FC<ProjectFileTreeProps> = ({ files, onSelectFile, onDoubleClickFile, onRefreshInBrowserFiles }) => {
  const { selectedProject, deleteFile, getProjectFiles, deleteInBrowserFile } = useProjects();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>(['root']);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Convert files to tree items format
  const treeItems = useMemo(() => {
    console.log('[ProjectFileTree useMemo - treeItems] Recalculating treeItems. Input files:', files); // Debug log
    
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
    console.log('[ProjectFileTree useMemo - dataProvider] Recalculating dataProvider. Input treeItems:', treeItems); // Debug log
    return new StaticTreeDataProvider(treeItems, (item, data) => ({ ...item, data }));
  }, [treeItems]);

  // Handle selecting a file (single click)
  const handleSelect = (items: TreeItemIndex[], treeId: string) => {
    console.log("[ProjectFileTree] handleSelect triggered");
    if (!items.length) return;
    const selectedPath = items[0].toString();
    const treeItem = treeItems[selectedPath];
    if (treeItem && !treeItem.isFolder) {
      const selectedFile = files.find(f => f.path === treeItem.path);
      if (selectedFile) {
        // console.log("[ProjectFileTree] Calling onSelectFile"); // Keep log commented out or remove
        // onSelectFile(selectedFile).catch(console.error); // REMOVED: Do not load file on single click
        console.log(`[ProjectFileTree] File selected (single click): ${selectedFile.path}`); // Log selection only
      }
    }
    // Note: The react-complex-tree library likely handles the visual selection state automatically.
    // If visual selection stops working, we might need to manage 'selectedItems' state here.
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
    if (!fileToDelete) return;

    try {
      if (selectedProject?.id === 'in-browser') {
        await deleteInBrowserFile(fileToDelete);
        // Call the refresh function if provided
        if (onRefreshInBrowserFiles) {
           console.log('[ProjectFileTree] Calling onRefreshInBrowserFiles...'); // Log before
           await onRefreshInBrowserFiles(); // Ensure this is awaited
           console.log('[ProjectFileTree] onRefreshInBrowserFiles finished.'); // Log after
        } else {
           console.warn('[ProjectFileTree] onRefreshInBrowserFiles not provided.');
        }
      } else if (selectedProject?.id) {
        await deleteFile(selectedProject.id, fileToDelete);
        await getProjectFiles(selectedProject.id); // Refresh remote files
      } else {
        console.error('No project selected or invalid project ID for deletion');
      }
    } catch (error) {
      console.error('Error during delete/refresh:', error); // More specific logging
    } finally {
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    }
  };

  // Rename back to handleDoubleClick and bind to onPrimaryAction
  const handleDoubleClick = (item: RCTTreeItem<string>, treeId: string) => {
    console.log("[ProjectFileTree] handleDoubleClick triggered");
    const treeItem = treeItems[item.index as string];
    if (treeItem && !treeItem.isFolder) {
      const selectedFile = files.find(f => f.path === treeItem.path);
      if (selectedFile) {
        console.log("[ProjectFileTree] Calling onDoubleClickFile");
        onDoubleClickFile(selectedFile).catch(console.error);
      }
    }
  };

  // Render function - remove direct click handlers
  const renderTitle = ({ title, item, context }: { 
    title: string; 
    item: RCTTreeItem<string>; 
    context: TreeItemRenderContext<"expandedItems" | "selectedItems">; 
  }) => {
    const isHovered = hoveredItemId === item.index.toString();
    const isDeletable = !item.isFolder;
    const itemData = treeItems[item.index as string];
    const itemPath = itemData?.path;

    // The main clickable area provided by react-complex-tree (likely a button internally)
    // We put the icon and title inside this.
    const mainContent = (
      <div className="flex items-center gap-2 flex-1 truncate">
        {getFileIcon(item.data as string, item.isFolder || false, expandedItems.includes(item.index.toString()))}
        <span className="flex-1 truncate">{title}</span>
      </div>
    );

    return (
      // Outer container for layout (flex row)
      <div 
        className="flex items-center justify-between gap-2 w-full pr-2" // Use justify-between
        onMouseEnter={() => setHoveredItemId(item.index.toString())}
        onMouseLeave={() => setHoveredItemId(null)}
      >
        {/* The library handles the primary action (double-click/enter) on the item itself,
            which internally wraps this content. We don't render a button here. */}
        {mainContent}
        
        {/* Delete button rendered separately, conditionally */} 
        {isHovered && isDeletable && itemPath && (
          <button 
            onClick={(e) => {
              // Prevent the click from triggering the item's primary action (double-click)
              e.stopPropagation(); 
              handleDeleteFile(itemPath); 
            }}
            className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors duration-150 flex-shrink-0"
            title={`Delete ${title}`}
            aria-label={`Delete ${title}`}
          >
            <FaTrash className="w-3 h-3" />
          </button>
        )}
      </div>
    );
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
          ['tree-1']: {
            expandedItems,
            selectedItems: [],
          }
        }}
        // Reinstate the library's event handlers
        onSelectItems={handleSelect} 
        onExpandItem={handleExpand}
        onCollapseItem={handleCollapse}
        onPrimaryAction={handleDoubleClick}
        renderItemTitle={renderTitle}
      >
        <Tree treeId="tree-1" rootItem="root" />
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