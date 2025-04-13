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
 * with the current notebook's state (project, file).
 * If the projectId is 'in-browser', the 'project' param is omitted from the URL.
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
    let targetProjectForUrl: string | null = null;
    let targetFileForUrl: string | null = null;

    if (currentProjectId && currentFilePath) {
      // Omit 'in-browser' projectId from URL
      targetProjectForUrl = currentProjectId === 'in-browser' ? null : currentProjectId;
      targetFileForUrl = currentFilePath;
    }

    // Get current URL params using new names
    const urlProject = searchParams.get('project');
    const urlFile = searchParams.get('file');

    // Check if URL parameters need updating
    const needsUpdate = urlProject !== targetProjectForUrl || urlFile !== targetFileForUrl;

    if (needsUpdate) {
      if (targetFileForUrl) { // We always need 'file' if there's a valid notebook
        const paramsToSet: Record<string, string> = { file: targetFileForUrl };
        if (targetProjectForUrl) {
          paramsToSet.project = targetProjectForUrl; // Use 'project' key
        }
        console.log('[useUrlSync] Updating URL params from state:', paramsToSet);
        setSearchParams(paramsToSet, { replace: true });

        // Persist the *actual* last opened state, including 'in-browser' projectId
        // Local storage still uses the original keys
        if (currentProjectId && currentFilePath) {
          localforage.setItem('lastNotebookState', { projectId: currentProjectId, filePath: currentFilePath })
            .catch(err => console.error('Failed to save last notebook state:', err));
        }
      } else {
        // If state represents an unsaved/invalid notebook, clear URL params
        if (urlProject || urlFile) { // Check existing new param names
          console.log('[useUrlSync] Clearing URL params (no valid file/project in metadata).');
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