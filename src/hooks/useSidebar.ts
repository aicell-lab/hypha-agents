import { useState, useCallback } from 'react';
import { SidebarState } from '../utils/agentLabTypes';
import { 
  getDefaultSidebarWidth, 
  saveSidebarWidth,
  saveSidebarWidthDebounced 
} from '../utils/splitterStorage';

export const useSidebar = (): SidebarState => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => getDefaultSidebarWidth());

  const handleSidebarResize = useCallback((newWidth: number) => {
    setSidebarWidth(newWidth);
    saveSidebarWidthDebounced(newWidth);
  }, []);

  const handleSidebarResizeEnd = useCallback(() => {
    saveSidebarWidth(sidebarWidth);
  }, [sidebarWidth]);

  return {
    isSidebarOpen,
    sidebarWidth,
    setIsSidebarOpen,
    handleSidebarResize,
    handleSidebarResizeEnd
  };
}; 