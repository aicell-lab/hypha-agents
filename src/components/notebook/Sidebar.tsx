import React, { useCallback, useEffect, useState } from 'react';
import { FaBook, FaCode, FaExchangeAlt, FaCog, FaChevronLeft, FaChevronRight, FaRobot, FaHistory } from 'react-icons/fa';
import { MdOutlineExtension } from 'react-icons/md';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onResize?: (width: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  onResize
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  
  // Detect mobile screen size and very small screens
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsHidden(window.innerWidth <= 480); // Hide sidebar completely on very small screens
    };
    
    // Initial check
    checkScreenSize();
    
    // Add event listener
    window.addEventListener('resize', checkScreenSize);
    
    // Clean up
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  const tabs = [
    { id: 'agent', label: 'Agent', icon: <FaRobot /> },
    { id: 'tools', label: 'Tools', icon: <MdOutlineExtension /> },
    { id: 'history', label: 'History', icon: <FaHistory /> },
    { id: 'knowledge', label: 'Knowledge', icon: <FaBook /> },
    { id: 'code', label: 'Code', icon: <FaCode /> },
    { id: 'variables', label: 'Variables', icon: <FaExchangeAlt /> },
    { id: 'settings', label: 'Settings', icon: <FaCog /> },
  ];
  
  // Add resize functionality
  const handleResize = useCallback((e: React.MouseEvent) => {
    if (!onResize || isMobile) return;
    
    const startX = e.clientX;
    const startWidth = isOpen ? 240 : 48;
    
    const doDrag = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(48, Math.min(400, startWidth + moveEvent.clientX - startX));
      onResize(newWidth);
    };
    
    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    
    e.preventDefault();
  }, [isOpen, onResize, isMobile]);

  // Handle tab click - opens sidebar if closed
  const handleTabClick = (tabId: string) => {
    if (!isOpen) {
      onToggle();
    }
    onTabChange(tabId);
  };

  return (
    <>
      {/* Floating button for very small screens */}
      {isHidden && !isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-white shadow-lg rounded-r-lg p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-colors"
          title="Open sidebar"
        >
          <FaChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Main Sidebar */}
      <div 
        className={`h-full border-r border-gray-200 bg-white transition-all duration-300 flex flex-col relative ${
          isMobile ? (isOpen ? 'sidebar-expanded-width' : 'sidebar-collapsed-width') : ''
        } ${isHidden && !isOpen ? 'hidden' : ''}`}
        style={{ width: isOpen ? '240px' : '48px' }}
      >
        {/* Sidebar Header - Only shown when open */}
        {isOpen && (
          <div className="p-2 border-b border-gray-200 flex justify-between items-center">
            <span className="font-medium text-gray-700">Agent Lab</span>
            <button 
              onClick={onToggle}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
              title="Collapse sidebar"
            >
              <FaChevronLeft />
            </button>
          </div>
        )}

        {/* Sidebar Navigation */}
        <nav className={`flex-1 overflow-y-auto ${isOpen ? 'py-2' : 'py-1'}`}>
          <ul>
            {tabs.map((tab) => (
              <li key={tab.id} className={`${isOpen ? 'px-2 mb-1' : 'mb-1'}`}>
                <button
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center w-full ${isOpen ? 'p-2' : 'p-3'} rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={tab.label}
                >
                  <span className="text-lg">{tab.icon}</span>
                  {isOpen && <span className="ml-3 text-sm">{tab.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer - Only shown when open */}
        {isOpen && (
          <div className="p-2 border-t border-gray-200 mt-auto">
            <div className="text-xs text-gray-500 text-center">
              Hypha Agents v1.0
            </div>
          </div>
        )}
        
        {/* Resize Handle - Only on desktop */}
        {onResize && !isMobile && (
          <div 
            className="sidebar-resizer" 
            onMouseDown={handleResize}
            title="Resize sidebar"
          />
        )}
      </div>
    </>
  );
};

export default Sidebar; 