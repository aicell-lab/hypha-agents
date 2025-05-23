// Utility functions for saving and loading splitter positions from localStorage

interface SplitterPositions {
  sidebarWidth: number;
  canvasPanelWidth: number;
}

const STORAGE_KEY = 'hypha-agents-splitter-positions';

// Default values
const DEFAULT_POSITIONS: SplitterPositions = {
  sidebarWidth: 280,
  canvasPanelWidth: 600,
};

// Debounce timers
let sidebarSaveTimer: NodeJS.Timeout | null = null;
let canvasPanelSaveTimer: NodeJS.Timeout | null = null;

/**
 * Save splitter positions to localStorage
 */
export const saveSplitterPositions = (positions: Partial<SplitterPositions>): void => {
  try {
    const currentPositions = loadSplitterPositions();
    const updatedPositions = { ...currentPositions, ...positions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPositions));
  } catch (error) {
    console.warn('Failed to save splitter positions to localStorage:', error);
  }
};

/**
 * Load splitter positions from localStorage
 */
export const loadSplitterPositions = (): SplitterPositions => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        sidebarWidth: typeof parsed.sidebarWidth === 'number' ? parsed.sidebarWidth : DEFAULT_POSITIONS.sidebarWidth,
        canvasPanelWidth: typeof parsed.canvasPanelWidth === 'number' ? parsed.canvasPanelWidth : DEFAULT_POSITIONS.canvasPanelWidth,
      };
    }
  } catch (error) {
    console.warn('Failed to load splitter positions from localStorage:', error);
  }
  return DEFAULT_POSITIONS;
};

/**
 * Save sidebar width to localStorage
 */
export const saveSidebarWidth = (width: number): void => {
  saveSplitterPositions({ sidebarWidth: width });
};

/**
 * Save canvas panel width to localStorage
 */
export const saveCanvasPanelWidth = (width: number): void => {
  saveSplitterPositions({ canvasPanelWidth: width });
};

/**
 * Save sidebar width to localStorage with debouncing
 */
export const saveSidebarWidthDebounced = (width: number): void => {
  if (sidebarSaveTimer) {
    clearTimeout(sidebarSaveTimer);
  }
  sidebarSaveTimer = setTimeout(() => {
    saveSidebarWidth(width);
  }, 300); // 300ms debounce
};

/**
 * Save canvas panel width to localStorage with debouncing
 */
export const saveCanvasPanelWidthDebounced = (width: number): void => {
  if (canvasPanelSaveTimer) {
    clearTimeout(canvasPanelSaveTimer);
  }
  canvasPanelSaveTimer = setTimeout(() => {
    saveCanvasPanelWidth(width);
  }, 300); // 300ms debounce
};

/**
 * Get default sidebar width
 */
export const getDefaultSidebarWidth = (): number => {
  return loadSplitterPositions().sidebarWidth;
};

/**
 * Get default canvas panel width
 */
export const getDefaultCanvasPanelWidth = (): number => {
  return loadSplitterPositions().canvasPanelWidth;
}; 