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
  
  // Detect mobile screen size
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener
    window.addEventListener('resize', checkIfMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
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

  return (
    <div 
      className={`h-full border-r border-gray-200 bg-white transition-all duration-300 flex flex-col relative ${
        isMobile ? (isOpen ? 'sidebar-expanded-width' : 'sidebar-collapsed-width') : ''
      }`}
      style={{ width: isOpen ? '240px' : '48px' }}
    >
      {/* Sidebar Header */}
      <div className="p-2 border-b border-gray-200 flex justify-between items-center">
        {isOpen && <span className="font-medium text-gray-700">Agent Lab</span>}
        <button 
          onClick={onToggle}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
          title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isOpen ? <FaChevronLeft /> : <FaChevronRight />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul>
          {tabs.map((tab) => (
            <li key={tab.id} className="px-2 mb-1">
              <button
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center w-full p-2 rounded-md transition-colors ${
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

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-gray-200 mt-auto">
        {isOpen && (
          <div className="text-xs text-gray-500 text-center">
            Hypha Agents v1.0
          </div>
        )}
      </div>
      
      {/* Resize Handle - Only on desktop */}
      {onResize && !isMobile && (
        <div 
          className="sidebar-resizer" 
          onMouseDown={handleResize}
          title="Resize sidebar"
        />
      )}
    </div>
  );
};

export default Sidebar; 