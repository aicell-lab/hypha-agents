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

// Store references to toasts that need manual dismissal
const activeToasts = new Map<string, HTMLElement>();

/**
 * Downloads the notebook data as a JSON file.
 * @param notebookData The notebook data to download.
 * @param filename Optional specific filename (without extension).
 */
export function downloadNotebook(notebook: NotebookData, filename?: string): void {
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
    })),
    nbformat: 4,
    nbformat_minor: 5
  };

  const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const downloadFilename = filename
    ? `${filename.replace(/\s+/g, '_')}.ipynb`
    : `${notebookData.metadata.title?.replace(/\s+/g, '_') || 'untitled'}.ipynb`;
  a.download = downloadFilename;
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

/**
 * Shows a toast message.
 * @param message The message to display.
 * @param type The type of toast ('success', 'error', 'warning', 'loading').
 * @param options Optional parameters: duration (ms) for auto-dismissal, id for manual dismissal.
 */
export function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'loading' = 'success',
  options: { duration?: number; id?: string } = {}
): void {
  const { duration = 2000, id } = options;

  // If an ID is provided and a toast with that ID already exists, remove the old one first.
  if (id && activeToasts.has(id)) {
    dismissToast(id);
  }

  const messageDiv = document.createElement('div');
  messageDiv.style.opacity = '1'; // Start fully visible

  let iconSpan = document.createElement('span');
  iconSpan.className = 'inline-block mr-2'; // Add margin for spacing

  // Choose icon based on type
  switch (type) {
    case 'success':
      iconSpan.textContent = '✔️';
      break;
    case 'warning':
      iconSpan.textContent = '⚠️';
      break;
    case 'error':
      iconSpan.textContent = '❌';
      break;
    case 'loading':
      // Simple CSS spinner
      iconSpan.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>`;
      break;
  }

  // Combine classes for new style, positioning, and layout
  messageDiv.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 \
                          bg-white text-gray-800 \
                          px-4 py-2 rounded shadow-xl border border-blue-500 \
                          z-[100] transition-opacity duration-300 ease-out \
                          flex items-center`; // Increased z-index

  // Set content with icon and message
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  messageDiv.appendChild(iconSpan);
  messageDiv.appendChild(messageSpan);

  document.body.appendChild(messageDiv);

  // If an ID is provided, store the reference for manual dismissal
  if (id) {
    activeToasts.set(id, messageDiv);
  } else {
    // Auto-dismiss logic for toasts without an ID
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(messageDiv)) {
          document.body.removeChild(messageDiv);
        }
      }, 300); // Wait for opacity transition before removing
    }, duration);
  }
}

/**
 * Dismisses a specific toast message by its ID.
 * @param id The ID of the toast to dismiss.
 */
export function dismissToast(id: string): void {
  const toastElement = activeToasts.get(id);
  if (toastElement) {
    toastElement.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(toastElement)) {
        document.body.removeChild(toastElement);
      }
      activeToasts.delete(id); // Clean up map entry
    }, 300); // Wait for fade out before removing
  }
}

// Generate a unique ID for a notebook file
/* Removed problematic stub
export function generateNotebookId(projectId: string | undefined, filePath: string): string {
  // ... existing code ...
}
*/ 