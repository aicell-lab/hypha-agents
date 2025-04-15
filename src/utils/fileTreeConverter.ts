import { TreeNode } from '../hooks/useTraverseTree';
import { ProjectFile } from '../providers/ProjectsProvider';

/**
 * Converts an array of ProjectFile objects into a hierarchical TreeNode structure
 * for use with the FileTree component
 * 
 * @param files Array of ProjectFile objects
 * @param basePathPrefix Optional base path to correctly construct node IDs
 * @returns A TreeNode object representing the root of the file tree
 */
export function convertProjectFilesToTreeNodes(files: ProjectFile[], basePathPrefix: string = 'root'): TreeNode {
  // Create root node based on prefix or default
  const rootNodeId = basePathPrefix === 'root' ? 'root' : basePathPrefix.endsWith('/') ? basePathPrefix.slice(0, -1) : basePathPrefix;
  const rootNodeName = rootNodeId === 'root' ? 'Files' : rootNodeId.split('/').pop() || 'Files';
  const root: TreeNode = {
    id: rootNodeId,
    name: rootNodeName,
    isFolder: true,
    items: []
  };

  if (!files || files.length === 0) {
    return root;
  }

  // Use a Map to build the structure efficiently
  const nodeMap = new Map<string, TreeNode>();
  if (basePathPrefix === 'root') {
    nodeMap.set('root', root); // Add the actual root if basePathPrefix is 'root'
  }

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentPath = '';
    let parentNode = basePathPrefix === 'root' ? root : null; // Start from root only if basePathPrefix is 'root'

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // Only process parts that are within or below the basePathPrefix
      if (!currentPath.startsWith(rootNodeId) && rootNodeId !== 'root') continue;

      if (!nodeMap.has(currentPath)) {
        // Create node if it doesn't exist
        const newNode: TreeNode = {
          id: currentPath,
          name: part,
          isFolder: !isLastPart || file.type === 'directory',
          items: []
        };
        nodeMap.set(currentPath, newNode);

        // Link to parent if parent exists
        if (parentNode) {
          // Avoid adding duplicates
          if (!parentNode.items.some(item => item.id === newNode.id)) {
             parentNode.items.push(newNode);
          }
        }
      } else {
         // If node exists, ensure its isFolder status is correct if it's a directory
         const existingNode = nodeMap.get(currentPath)!;
         if (!isLastPart && !existingNode.isFolder) {
            existingNode.isFolder = true; // Mark as folder if it has children
         }
      }
      
      // Update parentNode for the next iteration
      parentNode = nodeMap.get(currentPath)!;
    }
  });

  // If basePathPrefix is not 'root', we return the node corresponding to the prefix
  // Otherwise, we return the actual root node.
  return nodeMap.get(rootNodeId) || root;
} 