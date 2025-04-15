import { TreeNode } from '../hooks/useTraverseTree';
import { ProjectFile } from '../providers/ProjectsProvider';

/**
 * Converts an array of ProjectFile objects into a hierarchical TreeNode structure
 * for use with the FileTree component
 * 
 * @param files Array of ProjectFile objects
 * @returns A TreeNode object representing the root of the file tree
 */
export function convertProjectFilesToTreeNodes(files: ProjectFile[]): TreeNode {
  // Create root node
  const root: TreeNode = {
    id: 'root',
    name: 'Files',
    isFolder: true,
    items: []
  };

  if (!files || files.length === 0) {
    return root;
  }

  // First, organize files by their path for quick lookup
  const pathMap = new Map<string, TreeNode>();
  pathMap.set('root', root);

  // Helper to ensure a directory node exists
  const ensureDirectoryExists = (path: string, name: string): TreeNode => {
    if (pathMap.has(path)) {
      return pathMap.get(path) as TreeNode;
    }

    // Create directory node
    const dirNode: TreeNode = {
      id: path,
      name: name,
      isFolder: true,
      items: []
    };

    pathMap.set(path, dirNode);
    return dirNode;
  };

  // Process each file
  files.forEach(file => {
    // Skip if this is a directory that will be created by ensureDirectoryExists
    if (file.type === 'directory' && pathMap.has(file.path)) {
      return;
    }

    const isFolder = file.type === 'directory';
    const pathParts = file.path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // Create node for this file
    const fileNode: TreeNode = {
      id: file.path,
      name: fileName || file.name,
      isFolder: isFolder,
      items: []
    };

    // Add to path map
    pathMap.set(file.path, fileNode);

    // If root level file
    if (pathParts.length === 1) {
      root.items.push(fileNode);
      return;
    }

    // Otherwise, ensure parent directory exists and add as child
    const parentPath = pathParts.slice(0, -1).join('/');
    const parentName = pathParts[pathParts.length - 2];
    const parentNode = ensureDirectoryExists(parentPath, parentName);
    
    // Add to parent's items
    parentNode.items.push(fileNode);
  });

  // Create the tree structure by adding children to their parents
  // (we've already done this via the ensureDirectoryExists and direct pushing)

  return root;
} 