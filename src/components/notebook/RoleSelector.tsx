import React, { useState, useRef, useEffect } from 'react';

export type CellRole = 'user' | 'assistant' | 'system';

interface RoleSelectorProps {
  role?: CellRole;
  onChange: (role: CellRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ role = 'user', onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roleInfo = {
    user: { icon: '👤', label: 'User' },
    assistant: { icon: '🤖', label: 'Assistant' },
    system: { icon: '⚙️', label: 'System' }
  };

  // Handle click outside to close dropdown
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling up to cell
    setIsOpen(!isOpen);
  };

  const handleRoleSelect = (selectedRole: CellRole) => {
    onChange(selectedRole);
    setIsOpen(false);
  };

  return (
    <div 
      ref={dropdownRef}
      className="relative inline-block"
    >
      {/* Trigger button - shows only icon */}
      <button
        onClick={handleClick}
        className="text-xl text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
        title="Change cell role"
      >
        {roleInfo[role].icon}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1 py-1 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          {Object.entries(roleInfo).map(([roleKey, { icon, label }]) => (
            <button
              key={roleKey}
              className={`w-full px-4 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 ${
                roleKey === role ? 'bg-gray-50' : ''
              }`}
              onClick={() => handleRoleSelect(roleKey as CellRole)}
            >
              <span className="text-base">{icon}</span>
              <span className="text-sm text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}; 