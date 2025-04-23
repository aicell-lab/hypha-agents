import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import localforage from 'localforage';
import { Project, IN_BROWSER_PROJECT } from '../providers/ProjectsProvider';
import { NotebookMetadata, NotebookCell, CellRole, CellType } from '../types/notebook';
import { CellManager } from '../pages/CellManager';
import { parseEditParam } from '../utils/urlParamUtils';

// Define the structure for the returned URL parameters
export interface InitialUrlParams {
  projectId: string | null;
  filePath: string | null;
  agentId: string | null;
  edit: {
    workspace: string;
    agentId: string;
  } | null;
}

interface UseNotebookInitializationProps {
  isLoggedIn: boolean;
  initialLoadComplete: boolean;
  setSelectedProject: (project: Project | null) => void;
  getInBrowserProject: () => Project;
  setNotebookMetadata: (metadata: NotebookMetadata) => void;
  setCells: (cells: NotebookCell[]) => void;
  setExecutionCounter: (count: number) => void;
  defaultNotebookMetadata: NotebookMetadata;
  cellManagerRef: React.MutableRefObject<CellManager | null>;
  projects: Project[];
}

// Return type includes the parsed URL parameters
interface UseNotebookInitializationResult {
  hasInitialized: React.MutableRefObject<boolean>;
  initialUrlParams: InitialUrlParams | null;
}

/**
 * Custom hook to handle initial setup checks like login status, project loading,
 * and parsing URL parameters. It no longer automatically loads or creates notebooks.
 */
export function useNotebookInitialization({
  isLoggedIn,
  initialLoadComplete,
  setSelectedProject,
  getInBrowserProject,
  setNotebookMetadata,
  setCells,
  setExecutionCounter,
  defaultNotebookMetadata,
  cellManagerRef,
  projects,
}: UseNotebookInitializationProps): UseNotebookInitializationResult {
  const [searchParams] = useSearchParams();
  const hasInitialized = useRef<boolean>(false);
  const [initialUrlParams, setInitialUrlParams] = useState<InitialUrlParams | null>(null);

  useEffect(() => {
    // --- PRIMARY GUARD: Only run this effect once ---
    if (hasInitialized.current) {
      return;
    }

    // --- Logic to determine initial state ---
    const determineInitialState = async () => {
      // Get URL parameters
      const urlProject = searchParams.get('project');
      const urlFile = searchParams.get('file');
      const urlAgent = searchParams.get('agent');
      const urlEdit = searchParams.get('edit');

      // Parse edit parameter using utility function
      const editParams = parseEditParam(urlEdit);

      // Store parsed params
      setInitialUrlParams({
        projectId: urlProject,
        filePath: urlFile,
        agentId: urlAgent,
        edit: editParams
      });

      // Determine if dependencies are ready for potential remote actions later
      const dependenciesReady = initialLoadComplete;

      console.log('[useNotebookInit] Parsing URL params:', { urlProject, urlFile, urlAgent, edit: urlEdit });
      console.log('[useNotebookInit] Dependencies ready:', dependenciesReady);
      console.log('[useNotebookInit] Logged in:', isLoggedIn);

      // Basic initialization is now considered complete after parsing params
      // and checking initial load state.
      // Actual notebook loading/creation will be user-triggered.
      hasInitialized.current = true;
      console.log('[useNotebookInit] Basic initialization complete. Ready for user actions.');

      // Set a default empty state initially, user action will load/create real content
      setNotebookMetadata(defaultNotebookMetadata);
      setCells([]);
      setExecutionCounter(1);
      // If a project was specified in URL, select it, otherwise default to in-browser
      // This might be needed for the sidebar to show the correct context
      if (urlProject && projects.find(p => p.id === urlProject)) {
        setSelectedProject(projects.find(p => p.id === urlProject) || null);
      } else if (!urlProject && urlFile) {
        // If only file is present, assume in-browser
        setSelectedProject(getInBrowserProject());
      }
      // If agent is present, select project if specified, otherwise default to in-browser
      else if (urlAgent) {
          if (urlProject && projects.find(p => p.id === urlProject)) {
              setSelectedProject(projects.find(p => p.id === urlProject) || null);
          } else {
              setSelectedProject(getInBrowserProject());
          }
      } else {
        // If nothing in URL, try loading last state project (if any)
        // This part might need adjustment depending on how we handle last state now
        // For now, let's default to in-browser if nothing else specified
        localforage.getItem('lastNotebookState').then(value => {
          const lastState = value as { projectId: string; filePath: string } | null;
          if (lastState?.projectId && lastState.projectId !== IN_BROWSER_PROJECT.id && projects.find(p => p.id === lastState.projectId)) {
            // Don't load the file, just select the project
            // setSelectedProject(projects.find(p => p.id === lastState.projectId) || null);
          } else {
            // setSelectedProject(getInBrowserProject());
          }
        }).catch(err => {
           console.warn('Error reading last state:', err);
           // setSelectedProject(getInBrowserProject());
        });
      }
    };

    // Only run determineInitialState if projects are loaded or if we are only dealing
    // with in-browser project scenarios (agent without project, file without project, or nothing)
    const urlProject = searchParams.get('project');
    if (initialLoadComplete || !urlProject) {
        determineInitialState();
    }
    else{
        console.log('[useNotebookInit] Waiting for projects to load...');
    }

  }, [
    isLoggedIn,
    initialLoadComplete, // Re-run when projects load if needed
    setSelectedProject,
    getInBrowserProject,
    setNotebookMetadata,
    setCells,
    setExecutionCounter,
    defaultNotebookMetadata,
    searchParams,
    projects, // Need projects list to select project from URL
  ]);

  return { hasInitialized, initialUrlParams };
}