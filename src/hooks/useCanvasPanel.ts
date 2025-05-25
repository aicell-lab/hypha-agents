import { useState, useCallback } from 'react';
import { CanvasPanelState } from '../utils/agentLabTypes';
import { 
  getDefaultCanvasPanelWidth, 
  saveCanvasPanelWidth,
  saveCanvasPanelWidthDebounced 
} from '../utils/splitterStorage';

export const useCanvasPanel = (): CanvasPanelState & {
  setCanvasPanelWidth: (width: number) => void;
  setShowCanvasPanel: (show: boolean) => void;
} => {
  const [canvasPanelWidth, setCanvasPanelWidth] = useState(() => getDefaultCanvasPanelWidth());
  const [showCanvasPanel, setShowCanvasPanel] = useState(false);
  const [hyphaCoreWindows, setHyphaCoreWindows] = useState<any[]>([]);
  const [activeCanvasTab, setActiveCanvasTab] = useState<string | null>(null);

  const toggleCanvasPanel = useCallback(() => {
    setShowCanvasPanel(prev => !prev);
  }, []);

  const handleCanvasPanelResize = useCallback((newWidth: number) => {
    setCanvasPanelWidth(newWidth);
    saveCanvasPanelWidthDebounced(newWidth);
  }, []);

  const handleCanvasPanelResizeEnd = useCallback(() => {
    saveCanvasPanelWidth(canvasPanelWidth);
  }, [canvasPanelWidth]);

  const handleTabClose = useCallback((tabId: string) => {
    setHyphaCoreWindows(prev => prev.filter(win => win.id !== tabId));
    
    // If no windows are left, close the panel
    setHyphaCoreWindows(prev => {
      const newWindows = prev.filter(win => win.id !== tabId);
      if (newWindows.length === 0) {
        setShowCanvasPanel(false);
      }
      return newWindows;
    });
    
    // If the active tab is being closed, set to null or first available
    if (activeCanvasTab === tabId) {
      setHyphaCoreWindows(prev => {
        const remainingWindows = prev.filter(win => win.id !== tabId);
        setActiveCanvasTab(remainingWindows.length > 0 ? remainingWindows[0].id : null);
        return remainingWindows;
      });
    }
  }, [activeCanvasTab]);

  return {
    showCanvasPanel,
    canvasPanelWidth,
    hyphaCoreWindows,
    activeCanvasTab,
    toggleCanvasPanel,
    handleCanvasPanelResize,
    handleCanvasPanelResizeEnd,
    handleTabClose,
    setActiveCanvasTab,
    setHyphaCoreWindows,
    setCanvasPanelWidth,
    setShowCanvasPanel
  };
}; 