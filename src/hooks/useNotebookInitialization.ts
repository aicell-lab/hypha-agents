import { useEffect, useRef, MutableRefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import localforage from 'localforage';
import { useProjects, Project, ProjectFile, IN_BROWSER_PROJECT } from '../providers/ProjectsProvider';
import { NotebookMetadata, NotebookCell, CellRole, CellType } from '../types/notebook';
import { CellManager } from '../pages/CellManager'; // Assuming CellManager is exported

// Define roles constant if not imported
const CELL_ROLES = {
  SYSTEM: 'system' as CellRole,
  ASSISTANT: 'assistant' as CellRole
};

interface UseNotebookInitializationProps {
  isLoggedIn: boolean | null;
  initialLoadComplete: boolean; // From ProjectsProvider
  loadNotebookContent: (projectId: string | undefined, filePath: string) => Promise<void>;
  setSelectedProject: (project: Project | null) => void;
  getInBrowserProject: () => Project;
  setNotebookMetadata: React.Dispatch<React.SetStateAction<NotebookMetadata>>;
  setCells: React.Dispatch<React.SetStateAction<NotebookCell[]>>;
  setExecutionCounter: React.Dispatch<React.SetStateAction<number>>;
  defaultNotebookMetadata: NotebookMetadata;
  cellManagerRef: MutableRefObject<CellManager | null>; // Use Ref for cellManager
  projects: Project[]; // Pass projects list directly
}

/**
 * Custom hook to handle the initial loading logic for the notebook.
 * Determines whether to load from URL params (project, file), local storage (last state), or a default state.
 * Returns a ref indicating whether initialization has completed.
 */
export function useNotebookInitialization({
  isLoggedIn,
  initialLoadComplete,
  loadNotebookContent,
  setSelectedProject,
  getInBrowserProject,
  setNotebookMetadata,
  setCells,
  setExecutionCounter,
  defaultNotebookMetadata,
  cellManagerRef,
  projects, // Use passed projects list
}: UseNotebookInitializationProps) {
  const [searchParams] = useSearchParams();
  const hasInitialized = useRef(false); // Manages initialization state internally

  useEffect(() => {
    // --- PRIMARY GUARD: Only run this effect once ---
    if (hasInitialized.current) {
      console.log('[useNotebookInit] Initialization already attempted, skipping effect run.');
      return;
    }
    // --- Mark initialization as attempted immediately ---
    // This prevents re-entry if dependencies change while async operations are pending.
    hasInitialized.current = true;
    console.log('[useNotebookInit] Marked initialization as attempted.');

    // --- Read NEW parameter names ---
    const urlProject = searchParams.get('project');
    const urlFile = searchParams.get('file');

    // --- Logic to determine initial load target ---
    const determineInitialLoad = async () => {
      let loadAttempted = false;
      let initializationFinalized = false; // Tracks if a final state (load/default) was reached

      // Determine if dependencies are ready for a potential remote load
      const dependenciesReady = initialLoadComplete;

      // --- Use NEW parameter names in the condition ---
      if (urlProject && urlFile) {
        // --- Attempt 1: Load from URL ---
        console.log('[useNotebookInit] Attempting load from URL:', { urlProject, urlFile });
        if (urlProject !== IN_BROWSER_PROJECT.id && !dependenciesReady) {
          console.log('[useNotebookInit] Waiting for project load before processing URL...');
          // Reset the flag so the effect can run again when dependencies ARE ready
          hasInitialized.current = false;
          console.log('[useNotebookInit] Resetting initialization attempted flag due to pending dependencies.');
          return; // Defer until projects are loaded
        }
        try {
          // --- Pass NEW parameter names to load function ---
          await loadNotebookContent(urlProject, urlFile);
          loadAttempted = true;
          initializationFinalized = true; // Assume success finalizes init
        } catch (error) {
          console.error('[useNotebookInit] Error loading from URL:', error);
          loadAttempted = true; // Still counts as an attempt
          // Reset state is handled within loadNotebookContent on error
          initializationFinalized = true; // Finalize even on error to prevent loops
        }
      } else if (urlFile && !urlProject) {
          // --- Handle case: Only 'file' param is present (implies 'in-browser' project) ---
          console.log('[useNotebookInit] Attempting load from URL (in-browser implied):', { urlFile });
          try {
            // Load with undefined projectId, which loadNotebookContent resolves to IN_BROWSER_PROJECT.id
            await loadNotebookContent(undefined, urlFile);
            loadAttempted = true;
            initializationFinalized = true;
          } catch (error) {
            console.error('[useNotebookInit] Error loading from URL (in-browser implied):', error);
            loadAttempted = true;
            initializationFinalized = true;
          }
      } else {
        // --- Attempt 2: Load from Local Storage (Last State) ---
        console.log('[useNotebookInit] No URL params, checking last state.');
        let loadedFromLastState = false;
        try {
          // Local storage still uses projectId/filePath keys
          const lastState = await localforage.getItem<{ projectId: string | null, filePath: string | null }>('lastNotebookState');
          if (lastState?.filePath) {
            const lastProjectId = lastState.projectId || IN_BROWSER_PROJECT.id;
            const lastFilePath = lastState.filePath;
            console.log('[useNotebookInit Fallback] Found last state:', { lastProjectId, lastFilePath });

            if (lastProjectId !== IN_BROWSER_PROJECT.id && !dependenciesReady) {
              console.log('[useNotebookInit] Waiting for project load before processing last state...');
              // Reset the flag so the effect can run again when dependencies ARE ready
              hasInitialized.current = false;
              console.log('[useNotebookInit] Resetting initialization attempted flag due to pending dependencies for last state.');
              return; // Defer until projects are loaded
            }

            const projectExists = lastProjectId === IN_BROWSER_PROJECT.id || projects.some(p => p.id === lastProjectId);

            if (projectExists) {
              console.log('[useNotebookInit Fallback] Attempting to load from last state...');
              try {
                // loadNotebookContent expects projectId/filePath internally
                await loadNotebookContent(lastProjectId, lastFilePath);
                loadAttempted = true;
                loadedFromLastState = true;
                initializationFinalized = true; // Assume success finalizes init
              } catch (loadError) {
                console.error('[useNotebookInit] Error loading from last state:', loadError);
                localforage.removeItem('lastNotebookState');
                loadAttempted = true;
                initializationFinalized = true; // Finalize even on error
              }
            } else {
              console.warn(`[useNotebookInit Fallback] Project '${lastProjectId}' not found. Clearing last state.`);
              localforage.removeItem('lastNotebookState');
            }
          }
        } catch (err) {
          console.error('[useNotebookInit Fallback] Error reading last state:', err);
        }

        // --- Attempt 3: Load Default/Welcome State ---
        // Only load default if no other load was attempted or succeeded
        if (!loadedFromLastState && !loadAttempted) {
          console.log('[useNotebookInit Fallback] Setting default welcome state.');
          setNotebookMetadata({
            ...defaultNotebookMetadata,
            title: 'Untitled Chat',
            filePath: undefined,
            projectId: IN_BROWSER_PROJECT.id,
          });
          setCells([]);
          setExecutionCounter(1);
          const manager = cellManagerRef.current;
          if (manager) {
            const systemCellId = manager.addCell('code', `# System startup script\nprint("System Ready")`, CELL_ROLES.SYSTEM);
            manager.addCell('markdown', `# Welcome to Hypha Agents\nStart chatting or create code/markdown cells.`, CELL_ROLES.ASSISTANT);
            if (systemCellId) {
              setCells(prev => prev.map(cell => cell.id === systemCellId ? { ...cell, metadata: { ...cell.metadata, isCodeVisible: false, isOutputVisible: false } } : cell));
            }
          }
          setSelectedProject(getInBrowserProject());
          loadAttempted = true;
          initializationFinalized = true; // Default state finalizes init
        }
      }

      // --- Finalization Notification ---
      // Log if the initialization process reached a concluding state
      if (initializationFinalized) {
         console.log('[useNotebookInit] Initialization sequence complete.');
      } else {
        // This case should ideally not happen if the logic covers all paths
        // but indicates the init process didn't conclude with a load/default action.
        console.warn('[useNotebookInit] Initialization sequence finished without a final load action.');
      }
    };

    // Run initialization logic only when login status is known and dependencies are met,
    // but *only* if initialization hasn't been successfully marked as attempted yet.
    if (isLoggedIn !== null && initialLoadComplete) {
        console.log('[useNotebookInit] Conditions met (logged in, projects loaded), proceeding with load determination.');
        determineInitialLoad();
    } else if (isLoggedIn !== null && !initialLoadComplete && urlFile && !urlProject) { // Allow in-browser URL load even if remote projects aren't finished loading
        console.log('[useNotebookInit] Conditions met (logged in, in-browser file param), proceeding with load determination.');
        determineInitialLoad();
    } else if (isLoggedIn !== null && !initialLoadComplete && !urlProject && !urlFile) { // Allow last state/default load check even if remote projects aren't finished
        console.log('[useNotebookInit] Conditions met (logged in, no project/file requested), proceeding with fallback load determination.');
        determineInitialLoad();
    } else {
        // If conditions aren't met, reset the flag so it can try again when they are.
        hasInitialized.current = false;
        console.log('[useNotebookInit] Waiting for login/initial project load... Resetting init attempt flag.', { isLoggedIn, initialLoadComplete });
    }

  }, [
    isLoggedIn,
    initialLoadComplete,
    projects, // Depend on the actual projects list
    searchParams,
    loadNotebookContent,
    setSelectedProject,
    getInBrowserProject,
    setNotebookMetadata,
    setCells,
    setExecutionCounter,
    defaultNotebookMetadata,
    cellManagerRef
  ]);

  return hasInitialized; // Note: This ref now indicates if an attempt *started*, not if it *completed*.
} 