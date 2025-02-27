import React, { useState, useRef, useEffect } from 'react';
import { useTools, Tool } from './ToolProvider';

interface ToolSelectorProps {
  onSelectTool?: (tool: Tool) => void;
  className?: string;
}

export const ToolSelector: React.FC<ToolSelectorProps> = ({ onSelectTool, className }) => {
  const { tools } = useTools();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Log when dropdown state changes for debugging
  useEffect(() => {
    console.log('ToolSelector dropdown state:', isOpen);
  }, [isOpen]);

  // Group tools by category
  const toolsByCategory = tools.reduce((acc, tool) => {
    const category = tool.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, Tool[]>);

  // Handle tool selection
  const handleToolSelect = (e: React.MouseEvent, tool: Tool) => {
    e.stopPropagation();
    console.log('Tool selected:', tool.name);
    if (onSelectTool) {
      onSelectTool(tool);
    }
    setIsOpen(false);
  };

  // Toggle dropdown
  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Toggling dropdown, current state:', isOpen);
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Tool button */}
      <button
        onClick={toggleDropdown}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Available Tools"
        aria-label="Open tools menu"
      >
        <svg 
          className="w-5 h-5 text-gray-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        {tools.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-blue-500 rounded-full">
            {tools.length}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-md shadow-lg z-[100] overflow-hidden border border-gray-200">
          <div className="py-2 max-h-96 overflow-y-auto">
            <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
              Available Tools ({tools.length})
            </div>
            
            {Object.keys(toolsByCategory).length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No tools available
              </div>
            ) : (
              Object.entries(toolsByCategory).map(([category, categoryTools]) => (
                <div key={category} className="mb-2">
                  <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50">
                    {category}
                  </div>
                  {categoryTools.map((tool) => (
                    <button
                      key={tool.name}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 transition-colors"
                      onClick={(e) => handleToolSelect(e, tool)}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          {tool.icon ? (
                            <span dangerouslySetInnerHTML={{ __html: tool.icon }} />
                          ) : (
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tool.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 