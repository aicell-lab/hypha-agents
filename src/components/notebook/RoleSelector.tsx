import React, { useState, useRef, useEffect } from 'react';

export type CellRole = 'user' | 'assistant' | 'system';

interface RoleSelectorProps {
  role?: CellRole;
  onChange: (role: CellRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ role = 'user', onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const roleInfo = {
    user: { icon: '👤', label: 'User' },
    assistant: { icon: '🤖', label: 'Assistant' },
    system: { icon: '⚙️', label: 'System' }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling up to cell
    setIsOpen(!isOpen);
  };

  const handleRoleSelect = (selectedRole: CellRole) => {
    onChange(selectedRole);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger button - shows only icon */}
      <button
        onClick={handleClick}
        className="text-xl text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
        title="Change cell role"
        aria-haspopup="true"
      >
        {roleInfo[role].icon}
      </button>

      {/* Horizontal options menu to the right */}
      {isOpen && (
        <div className="absolute left-full top-0 ml-2 flex items-center bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden z-10">
          {Object.entries(roleInfo).map(([roleKey, { icon, label }]) => (
            <button
              key={roleKey}
              className={`px-3 py-1.5 flex items-center gap-1 hover:bg-gray-100 transition-colors ${
                roleKey === role ? 'bg-gray-50 font-medium' : ''
              } ${roleKey !== 'system' ? 'border-r border-gray-200' : ''}`}
              onClick={() => handleRoleSelect(roleKey as CellRole)}
              title={label}
            >
              <span className="text-base">{icon}</span>
              <span className="text-sm text-gray-700 whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}; 