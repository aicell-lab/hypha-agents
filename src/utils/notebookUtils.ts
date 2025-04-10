import { NotebookCell, NotebookData, defaultNotebookMetadata } from '../types/notebook';
import Convert from 'ansi-to-html';

// Create a converter for ANSI codes to HTML
export const convert = new Convert({
  fg: '#000',
  bg: '#fff',
  newline: true,
  escapeXML: true,
  stream: false
});

// Strip ANSI escape codes from a string
export const stripAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');

// Create a copy function for downloading the notebook
export function downloadNotebook(notebook: NotebookData): void {
  const notebookData: NotebookData = {
    metadata: {
      ...notebook.metadata,
      modified: new Date().toISOString()
    },
    cells: notebook.cells.map(cell => ({
      ...cell,
      id: cell.id,
      type: cell.type,
      content: cell.content,
      executionCount: cell.executionCount,
      executionState: cell.executionState,
      output: cell.output ? cell.output.map(output => ({
        ...output,
        attrs: {
          ...output.attrs,
          className: undefined
        }
      })) : undefined,
      role: cell.role,
      metadata: {
        ...cell.metadata,
        role: cell.role,
        collapsed: false,
        trusted: true,
        parent: cell.metadata?.parent // Explicitly preserve parent key
      }
    }))
  };

  const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${notebookData.metadata.title?.replace(/\s+/g, '_')}.ipynb` || 'untitled.ipynb';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper function to copy text to clipboard
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  } catch (err) {
    console.error('Failed to copy text: ', err);
    showToast('Failed to copy to clipboard', 'error');
  }
}

// Helper to show a toast notification
export function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success', duration: number = 2000): void {
  const messageDiv = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-yellow-500';
  messageDiv.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500`;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(messageDiv)) {
        document.body.removeChild(messageDiv);
      }
    }, 500);
  }, duration);
} 