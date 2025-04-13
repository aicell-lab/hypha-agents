import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import localforage from 'localforage';
import { NotebookMetadata } from '../types/notebook';

interface UseUrlSyncProps {
  notebookMetadata: NotebookMetadata;
  hasInitialized: boolean;
}

/**
 * Custom hook to synchronize the browser URL search parameters
 * with the current notebook's state (projectId, filePath).
 * Also persists the last opened state to local storage.
 */
export function useUrlSync({
  notebookMetadata,
  hasInitialized,
}: UseUrlSyncProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    // Guard: Only run if initialization is complete
    if (!hasInitialized) {
      return;
    }

    const currentProjectId = notebookMetadata.projectId;
    const currentFilePath = notebookMetadata.filePath;

    // Determine target URL state based on current metadata
    let targetProjectId: string | null = null;
    let targetFilePath: string | null = null;

    if (currentProjectId && currentFilePath) {
      targetProjectId = currentProjectId;
      targetFilePath = currentFilePath;
    }

    // Get current URL params
    const urlProjectId = searchParams.get('projectId');
    const urlFilePath = searchParams.get('filePath');

    // Only update if the URL params need changing
    if (urlProjectId !== targetProjectId || urlFilePath !== targetFilePath) {
      if (targetProjectId && targetFilePath) {
        console.log('[useUrlSync] Updating URL params from state:', { targetProjectId, targetFilePath });
        setSearchParams({ projectId: targetProjectId, filePath: targetFilePath }, { replace: true });
        // Persist the last opened state
        localforage.setItem('lastNotebookState', { projectId: targetProjectId, filePath: targetFilePath })
          .catch(err => console.error('Failed to save last notebook state:', err));
      } else {
        // If state represents an unsaved/invalid notebook, clear URL params
        if (urlProjectId || urlFilePath) { // Only clear if params exist
          console.log('[useUrlSync] Clearing URL params (no valid file path/project in metadata).');
          setSearchParams({}, { replace: true });
          // Clear last state as well
          localforage.removeItem('lastNotebookState')
            .catch(err => console.error('Failed to remove last notebook state:', err));
        }
      }
    }

  // Dependencies: Run when the notebook's context changes or initialization completes
  }, [notebookMetadata.projectId, notebookMetadata.filePath, hasInitialized, searchParams, setSearchParams]);
} 