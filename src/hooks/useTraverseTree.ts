import { ReactNode } from 'react';

export interface TreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  items: TreeNode[];
}

const useTraverseTree = () => {
  function insertNode(tree: TreeNode, folderId: string, itemName: string, isFolder: boolean): TreeNode {
    if (tree.id === folderId && tree.isFolder) {
      tree.items.unshift({
        id: new Date().getTime().toString(),
        name: itemName,
        isFolder,
        items: [],
      });
      return { ...tree };
    }

    const updatedItems = tree.items.map((obj) => {
      return insertNode(obj, folderId, itemName, isFolder);
    });

    return { ...tree, items: updatedItems };
  }

  function deleteNode(tree: TreeNode, folderId: string): TreeNode | null {
    // base case: found the node to be deleted
    if (tree.id === folderId) {
      // Node found, return null to remove it from the parent
      return null;
    }

    if (tree.items && tree.items.length > 0) {
      // If the node has children, recursively process them
      const updatedItems = tree.items
        .map((child) => deleteNode(child, folderId))
        .filter(Boolean) as TreeNode[];

      return { ...tree, items: updatedItems };
    }

    return { ...tree };
  }

  function updateNode(tree: TreeNode, folderId: string, itemName: string): TreeNode {
    if (tree.id === folderId) {
      // Node found, update its properties
      return {
        ...tree,
        name: itemName,
      };
    }

    if (tree.items && tree.items.length > 0) {
      const updatedItems = tree.items.map((child) => 
        updateNode(child, folderId, itemName)
      );

      return { ...tree, items: updatedItems };
    }

    return { ...tree };
  }

  return { insertNode, deleteNode, updateNode };
};

export default useTraverseTree; 