import React, { useState, useRef, useEffect } from 'react';

interface AgentSettingsProps {
  instructions?: string;
  className?: string;
}

export const AgentSettingsPanel: React.FC<AgentSettingsProps> = ({ instructions, className }) => {
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

  // Toggle dropdown
  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Settings button */}
      <button
        onClick={toggleDropdown}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Agent Instructions"
        aria-label="View agent instructions"
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
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-96 bg-white rounded-md shadow-lg z-[100] overflow-hidden border border-gray-200">
          <div className="py-2 max-h-96 overflow-y-auto">
            <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
              Agent Instructions
            </div>
            
            <div className="p-4">
              {instructions ? (
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {instructions}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  No specific instructions defined for this agent.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 