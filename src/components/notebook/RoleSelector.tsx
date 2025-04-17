import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type CellRole = 'user' | 'assistant' | 'system';

interface RoleSelectorProps {
  role?: CellRole;
  onChange: (role: CellRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ role = 'user', onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const roleInfo = {
    user: { icon: '👤', label: 'User' },
    assistant: { icon: '🤖', label: 'Assistant' },
    system: { icon: '⚙️', label: 'System' }
  };

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // Position the dropdown below the button by default
      setDropdownPosition({
        top: rect.bottom + scrollY,
        left: rect.left + scrollX
      });
    }
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
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
    <>
      {/* Trigger button - shows only icon */}
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="text-xl text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
        title="Change cell role"
      >
        {roleInfo[role].icon}
      </button>

      {/* Dropdown menu rendered in portal */}
      {isOpen && createPortal(
        <div 
          className="fixed z-[9999] bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[120px]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
        >
          {Object.entries(roleInfo).map(([roleKey, { icon, label }]) => (
            <button
              key={roleKey}
              className={`w-full px-4 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 ${
                roleKey === role ? 'bg-gray-50' : ''
              }`}
              onClick={() => handleRoleSelect(roleKey as CellRole)}
            >
              <span className="text-base">{icon}</span>
              <span className="text-sm text-gray-700 whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}; 