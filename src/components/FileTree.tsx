import React, { useState, useRef, useEffect, useCallback } from "react";
import { TreeNode } from '../hooks/useTraverseTree';
import { 
  FolderIcon, 
  DocumentIcon, 
  ChevronRightIcon, 
  ChevronDownIcon, 
  PlusIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface FolderProps {
  explorerData: TreeNode;
  handleInsertNode: (folderId: string, itemName: string, isFolder: boolean) => void;
  handleDeleteNode: (folderId: string) => void;
  handleUpdateFolder: (folderId: string, itemName: string, isFolder: boolean) => void;
  onFileDoubleClick?: (fileId: string) => void;
  showRoot?: boolean;
  selectedFiles?: string[];
  onSelection?: (selectedIds: string[]) => void;
  isSelectedFile?: boolean;
  // Add a prop to track whether we're inside a tree
  insideTree?: boolean;
  // New props for customizable controls
  showControls?: boolean;
  onRefresh?: () => void;
  rootActions?: {
    label: string;
    icon?: JSX.Element;
    onClick: () => void;
  }[];
  isLoading?: boolean;
  onOpenDirectory?: (path: string) => Promise<void>;
}

const FileTree: React.FC<FolderProps> = ({
  explorerData,
  handleInsertNode,
  handleDeleteNode,
  handleUpdateFolder,
  onFileDoubleClick,
  showRoot = true,
  selectedFiles = [],
  onSelection,
  isSelectedFile = false,
  insideTree = false,
  showControls = false,
  onRefresh,
  rootActions = [],
  isLoading = false,
  onOpenDirectory,
}) => {
  // State for dropdown menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showNewItemInput, setShowNewItemInput] = useState<{
    visible: boolean;
    isFolder: boolean;
  }>({ visible: false, isFolder: false });
  const [newItemName, setNewItemName] = useState("");

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle creating new item
  const handleCreateNewItem = (isFolder: boolean) => {
    setShowNewItemInput({ visible: true, isFolder });
    setIsMenuOpen(false);
    setNewItemName("");
  };

  // Handle submitting new item
  const handleNewItemSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newItemName.trim()) {
      e.preventDefault();
      e.stopPropagation();
      handleInsertNode('root', newItemName.trim(), showNewItemInput.isFolder);
      setShowNewItemInput({ ...showNewItemInput, visible: false });
    }
  };

  // If this is the root element, we need to provide the tree role
  if (explorerData.id === 'root') {
    return (
      <div className="relative">
        {/* Root header with controls if enabled */}
        {showControls && (
          <div className="flex items-center justify-between p-2 border-b border-gray-200">
            <div className="font-medium text-sm text-gray-700">
              {/* Always show "Files" even if showRoot is false */}
              {showRoot ? (explorerData.name || "Files") : "Files"}
            </div>
            <div className="flex items-center space-x-1">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className={`p-1 rounded hover:bg-gray-100 text-gray-600 ${isLoading ? 'animate-spin' : ''}`}
                  title="Refresh"
                  disabled={isLoading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              
              {/* Actions menu */}
              {(rootActions.length > 0 || showRoot) && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-600 flex items-center"
                    title="Actions"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown menu */}
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                      {/* Default file tree actions */}
                      {showRoot && (
                        <>
                          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                            {explorerData.name || "Files"}
                          </div>
                          <button
                            onClick={() => handleCreateNewItem(true)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                          >
                            <FolderIcon className="h-3.5 w-3.5 mr-2 text-yellow-500" />
                            <span className="text-sm">New Folder</span>
                          </button>
                          <button
                            onClick={() => handleCreateNewItem(false)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                          >
                            <DocumentIcon className="h-3.5 w-3.5 mr-2 text-gray-500" />
                            <span className="text-sm">New File</span>
                          </button>
                          {rootActions.length > 0 && (
                            <div className="border-t border-gray-100"></div>
                          )}
                        </>
                      )}
                      
                      {/* Custom actions */}
                      {rootActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={action.onClick}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                        >
                          {action.icon && <span className="mr-2">{action.icon}</span>}
                          <span className="text-sm">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* New item input */}
        {showNewItemInput.visible && (
          <div className="flex items-center p-2 border-b border-gray-100">
            <span className="mr-2">
              {showNewItemInput.isFolder ? (
                <FolderIcon className="h-4 w-4 text-yellow-500" />
              ) : (
                <DocumentIcon className="h-4 w-4 text-gray-500" />
              )}
            </span>
            <input
              type="text"
              className="flex-1 bg-white text-gray-800 border border-gray-300 px-2 py-1 rounded text-sm"
              placeholder={`New ${showNewItemInput.isFolder ? 'folder' : 'file'} name`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={handleNewItemSubmit}
              autoFocus
              onBlur={() => setShowNewItemInput({ ...showNewItemInput, visible: false })}
            />
          </div>
        )}
        
        {/* Tree structure - only add the tree role to the part that actually contains tree items */}
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : (
          <div role="tree" aria-label="File Explorer">
            <FileTreeItem
              explorerData={explorerData}
              handleInsertNode={handleInsertNode}
              handleDeleteNode={handleDeleteNode}
              handleUpdateFolder={handleUpdateFolder}
              onFileDoubleClick={onFileDoubleClick}
              showRoot={showRoot}
              selectedFiles={selectedFiles}
              onSelection={onSelection}
              isSelectedFile={isSelectedFile}
              insideTree={true}
              onOpenDirectory={onOpenDirectory}
            />
          </div>
        )}
      </div>
    );
  }
  
  // Otherwise render without the tree role (it will be a treeitem)
  return (
    <FileTreeItem
      explorerData={explorerData}
      handleInsertNode={handleInsertNode}
      handleDeleteNode={handleDeleteNode}
      handleUpdateFolder={handleUpdateFolder}
      onFileDoubleClick={onFileDoubleClick}
      showRoot={showRoot}
      selectedFiles={selectedFiles}
      onSelection={onSelection}
      isSelectedFile={isSelectedFile}
      insideTree={insideTree}
      onOpenDirectory={onOpenDirectory}
    />
  );
};

// Extract the item rendering logic into a separate component
const FileTreeItem: React.FC<FolderProps> = ({
  explorerData,
  handleInsertNode,
  handleDeleteNode,
  handleUpdateFolder,
  onFileDoubleClick,
  showRoot = true,
  selectedFiles = [],
  onSelection,
  isSelectedFile = false,
  insideTree = false,
  onOpenDirectory,
}) => {
  const [nodeName, setNodeName] = useState<string>(explorerData?.name || "");
  const [expand, setExpand] = useState<boolean>(showRoot ? false : true);
  const [showInput, setShowInput] = useState<{
    visible: boolean;
    isFolder: boolean | null;
  }>({
    visible: false,
    isFolder: null,
  });
  const [updateInput, setUpdateInput] = useState<{
    visible: boolean;
    isFolder: boolean | null;
  }>({
    visible: false,
    isFolder: null,
  });

  // Touch handling state
  const lastTapTimeRef = useRef<number>(0);
  const doubleTapDelayMs = 300; // 300ms window for double tap
  const nodeRef = useRef<HTMLDivElement>(null);

  // Check if this file is selected
  const isSelected = selectedFiles.includes(explorerData.id) || isSelectedFile;

  // Determine if the node is a folder
  const isDirectory = explorerData.isFolder || explorerData.name.endsWith('.__dir__');
  // Get the display name (remove .__dir__ if present)
  const displayName = explorerData.name.endsWith('.__dir__')
    ? explorerData.name.replace('.__dir__', '')
    : explorerData.name;

  const handleNewFolderButton = (
    e: React.MouseEvent<HTMLButtonElement>,
    isFolder: boolean
  ) => {
    e.stopPropagation();
    setExpand(true);
    setShowInput({
      visible: true,
      isFolder,
    });
  };

  const handleUpdateFolderButton = (
    e: React.MouseEvent<HTMLButtonElement>,
    isFolder: boolean,
    nodeValue: string
  ) => {
    setNodeName(nodeValue);
    e.stopPropagation();
    setUpdateInput({
      visible: true,
      isFolder,
    });
  };

  const handleDeleteFolder = (
    e: React.MouseEvent<HTMLButtonElement>,
    isFolder: boolean
  ) => {
    e.stopPropagation();
    handleDeleteNode(explorerData.id);
  };

  const handleFileDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!explorerData.isFolder && onFileDoubleClick) {
      onFileDoubleClick(explorerData.id);
    }
  };

  // Modify handleFileClick for folders
  const handleFileClick = async (e: React.MouseEvent) => {
    if (updateInput.visible || showInput.visible) return;
    if (isDirectory) {
      // If not expanded and onOpenDirectory is provided, call it
      if (!expand && onOpenDirectory) {
        // Show loading state or indicator if needed
        await onOpenDirectory(explorerData.id); 
      }
      // Always toggle expand state for folders
      setExpand(!expand); 
      return;
    }
    
    if (!onSelection) return;

    // Prevent double-click from also triggering selection
    e.stopPropagation();
    
    if (e.shiftKey) {
      // Multi-select with shift key
      if (isSelected) {
        // If already selected, deselect it
        onSelection(selectedFiles.filter(id => id !== explorerData.id));
      } else {
        // Add to selection
        onSelection([...selectedFiles, explorerData.id]);
      }
    } else {
      // Single select
      onSelection([explorerData.id]);
    }
  };

  // Modify handleKeyDown for folders
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (updateInput.visible || showInput.visible) return;
    
    // Enter key
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isDirectory && onFileDoubleClick) {
        onFileDoubleClick(explorerData.id);
      } else if (isDirectory) {
        // If not expanded and onOpenDirectory is provided, call it
        if (!expand && onOpenDirectory) {
          await onOpenDirectory(explorerData.id); 
        }
        // Always toggle expand state
        setExpand(!expand);
      }
    }
    
    // Space key toggles selection
    if (e.key === ' ' && !isDirectory && onSelection) {
      e.preventDefault();
      if (isSelected) {
        onSelection(selectedFiles.filter(id => id !== explorerData.id));
      } else {
        onSelection([...selectedFiles, explorerData.id]);
      }
    }
  }, [explorerData, onFileDoubleClick, onSelection, selectedFiles, isSelected, expand, isDirectory, onOpenDirectory]);

  // Focus this element when it becomes selected
  useEffect(() => {
    if (isSelected && nodeRef.current) {
      nodeRef.current.focus();
    }
  }, [isSelected]);

  // Handle touch events for touch screens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDirectory) return; // Only handle file touches
    
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    
    if (timeSinceLastTap < doubleTapDelayMs) {
      // Double tap detected
      e.preventDefault();
      if (onFileDoubleClick) {
        onFileDoubleClick(explorerData.id);
      }
    }
    
    lastTapTimeRef.current = now;
  };
  
  const onAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value) {
      // Prevent event propagation
      e.stopPropagation();
      e.preventDefault();
      
      // Handle node creation
      handleInsertNode(explorerData.id, e.currentTarget.value, showInput.isFolder as boolean);
      setShowInput({ ...showInput, visible: false });
    }
  };

  const onUpdate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value) {
      // Stop event propagation to prevent click event from being triggered
      e.stopPropagation();
      e.preventDefault();
      
      // Call the rename function
      handleUpdateFolder(explorerData.id, e.currentTarget.value, explorerData.isFolder);
      
      // Hide the input field
      setUpdateInput({ ...updateInput, visible: false });
      
      // Slight delay to ensure event propagation is prevented
      setTimeout(() => {
        // Ensure we don't lose focus for accessibility
        if (nodeRef.current) {
          nodeRef.current.focus();
        }
      }, 10);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNodeName(event.target.value);
  };

  // Expand parent folders if this file is selected
  useEffect(() => {
    if (isSelected && !explorerData.isFolder && !expand) {
      setExpand(true);
    }
  }, [isSelected, explorerData.isFolder]);

  // If this is the root and showRoot is false, only render the children
  if (explorerData.id === 'root' && !showRoot) {
    return (
      <>
        {explorerData.items.map((item) => (
          <FileTree
            key={item.id}
            explorerData={item}
            handleInsertNode={handleInsertNode}
            handleDeleteNode={handleDeleteNode}
            handleUpdateFolder={handleUpdateFolder}
            onFileDoubleClick={onFileDoubleClick}
            showRoot={showRoot}
            selectedFiles={selectedFiles}
            onSelection={onSelection}
            isSelectedFile={item.id === selectedFiles[0] && selectedFiles.length === 1}
            insideTree={insideTree}
            onOpenDirectory={onOpenDirectory}
          />
        ))}
      </>
    );
  }

  if (isDirectory) {
    // Only use ARIA roles when inside a tree
    const folderProps = insideTree ? {
      role: "treeitem",
      "aria-expanded": expand
    } : {};

    return (
      <div className="file-tree-folder" {...folderProps}>
        <div 
          ref={nodeRef}
          className={`folder flex items-center cursor-pointer py-1 px-2 hover:bg-gray-100 rounded text-gray-700 relative group ${
            isSelected ? 'bg-blue-50 text-blue-800 border border-blue-300' : ''
          }`}
          onClick={handleFileClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <span className="mr-1">
            {expand ? 
              <ChevronDownIcon className="h-3.5 w-3.5" /> : 
              <ChevronRightIcon className="h-3.5 w-3.5" />
            }
          </span>
          <span className="mr-1">
            <FolderIcon className="h-4 w-4 text-yellow-500" />
          </span>
          
          {updateInput.visible ? (
            <input
              type="text"
              className="bg-white text-gray-800 border border-gray-300 px-2 py-0.5 rounded ml-1 text-sm"
              value={nodeName}
              onChange={handleChange}
              autoFocus
              onBlur={(e) => {
                // Prevent event propagation
                e.stopPropagation();
                setUpdateInput({ ...updateInput, visible: false });
              }}
              onKeyDown={onUpdate}
              placeholder="Folder name"
              aria-label="Edit folder name"
            />
          ) : (
            <span className="ml-1 text-sm truncate max-w-[150px] select-none">{displayName}</span>
          )}

          <div className="buttons-container ml-auto flex space-x-1 invisible group-hover:visible">
            <button
              className="p-0.5 hover:bg-gray-200 rounded"
              onClick={(e) => handleDeleteFolder(e, true)}
              title="Delete folder"
              aria-label="Delete folder"
            >
              <TrashIcon className="h-3.5 w-3.5 text-red-500" />
            </button>
            <button
              className="p-0.5 hover:bg-gray-200 rounded"
              onClick={(e) => handleUpdateFolderButton(e, true, explorerData.name)}
              title="Rename folder"
              aria-label="Rename folder"
            >
              <PencilIcon className="h-3.5 w-3.5 text-blue-500" />
            </button>
            <button
              className="p-0.5 hover:bg-gray-200 rounded relative"
              onClick={(e) => handleNewFolderButton(e, true)}
              title="New folder"
              aria-label="Create new folder"
            >
              <div className="relative">
                <FolderIcon className="h-3.5 w-3.5 text-yellow-500" />
                <PlusIcon className="h-2.5 w-2.5 text-green-500 absolute -bottom-0.5 -right-0.5" />
              </div>
            </button>
            <button
              className="p-0.5 hover:bg-gray-200 rounded relative"
              onClick={(e) => handleNewFolderButton(e, false)}
              title="New file"
              aria-label="Create new file"
            >
              <div className="relative">
                <DocumentIcon className="h-3.5 w-3.5 text-gray-500" />
                <PlusIcon className="h-2.5 w-2.5 text-green-500 absolute -bottom-0.5 -right-0.5" />
              </div>
            </button>
          </div>
        </div>

        <div 
          className={`pl-4 ${expand ? "block" : "hidden"}`} 
          {...(insideTree && expand ? { role: "group" } : {})}
        >
          {/* Add loading indicator if children haven't been loaded yet */}
          {expand && (!explorerData.items) && (
            <div className="pl-4 text-xs text-gray-400 italic">Loading...</div>
          )}
          {showInput.visible && (
            <div className="flex items-center my-1 text-gray-700">
              <span className="mr-1">
                {showInput.isFolder ? (
                  <FolderIcon className="h-4 w-4 text-yellow-500" />
                ) : (
                  <DocumentIcon className="h-4 w-4 text-gray-500" />
                )}
              </span>
              <input
                type="text"
                className="bg-white text-gray-800 border border-gray-300 px-2 py-0.5 rounded text-sm"
                autoFocus
                onBlur={(e) => {
                  // Prevent event propagation
                  e.stopPropagation();
                  setShowInput({ ...showInput, visible: false });
                }}
                onKeyDown={onAdd}
                placeholder={showInput.isFolder ? "Folder name" : "File name"}
                aria-label={showInput.isFolder ? "New folder name" : "New file name"}
              />
            </div>
          )}
          
          {explorerData.items && explorerData.items.map((item) => (
            <FileTree
              key={item.id}
              explorerData={item}
              handleInsertNode={handleInsertNode}
              handleDeleteNode={handleDeleteNode}
              handleUpdateFolder={handleUpdateFolder}
              onFileDoubleClick={onFileDoubleClick}
              showRoot={showRoot}
              selectedFiles={selectedFiles}
              onSelection={onSelection}
              isSelectedFile={item.id === selectedFiles[0] && selectedFiles.length === 1}
              insideTree={insideTree}
              onOpenDirectory={onOpenDirectory}
            />
          ))}
        </div>
      </div>
    );
  } else {
    // Only use ARIA roles when inside a tree
    const fileProps = insideTree ? {
      role: "treeitem"
    } : {};

    return (
      <div 
        ref={nodeRef}
        className={`folder flex items-center cursor-pointer py-1 px-2 hover:bg-gray-100 rounded text-gray-700 relative group ${
          isSelected ? 'bg-blue-50 text-blue-800 border border-blue-300' : ''
        }`}
        onClick={handleFileClick}
        onDoubleClick={handleFileDoubleClick}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        {...fileProps}
      >
        <span className="mr-1">
          <DocumentIcon className="h-4 w-4 text-gray-500" />
        </span>
        
        {updateInput.visible ? (
          <input
            type="text"
            className="bg-white text-gray-800 border border-gray-300 px-2 py-0.5 rounded ml-1 text-sm"
            value={nodeName}
            onChange={handleChange}
            autoFocus
            onBlur={(e) => {
              // Prevent event propagation
              e.stopPropagation();
              setUpdateInput({ ...updateInput, visible: false });
            }}
            onKeyDown={onUpdate}
            placeholder="File name"
            aria-label="Edit file name"
          />
        ) : (
          <span className="ml-1 text-sm truncate max-w-[180px] select-none">{displayName}</span>
        )}

        <div className="buttons-container ml-auto flex space-x-1 invisible group-hover:visible">
          <button
            className="p-0.5 hover:bg-gray-200 rounded"
            onClick={(e) => handleDeleteFolder(e, false)}
            title="Delete file"
            aria-label="Delete file"
          >
            <TrashIcon className="h-3.5 w-3.5 text-red-500" />
          </button>
          <button
            className="p-0.5 hover:bg-gray-200 rounded"
            onClick={(e) => handleUpdateFolderButton(e, false, explorerData.name)}
            title="Rename file"
            aria-label="Rename file"
          >
            <PencilIcon className="h-3.5 w-3.5 text-blue-500" />
          </button>
        </div>
      </div>
    );
  }
};

export default FileTree; 