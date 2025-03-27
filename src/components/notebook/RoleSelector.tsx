import React from 'react';

export type CellRole = 'user' | 'assistant' | 'system';

interface RoleSelectorProps {
  role?: CellRole;
  onChange: (role: CellRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ role = 'user', onChange }) => {
  const roleIcons = {
    user: '👤',
    assistant: '🤖',
    system: '⚙️'
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling up to cell
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation(); // Prevent change event from bubbling
    onChange(e.target.value as CellRole);
  };

  return (
    <div 
      className="relative inline-block"
      onClick={handleClick}
    >
      <select
        value={role}
        onChange={handleChange}
        className="appearance-none bg-transparent border-none text-xl leading-none p-0 text-gray-500 cursor-pointer hover:text-gray-700 transition-colors focus:outline-none focus:ring-0"
        title="Change cell role"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        {Object.entries(roleIcons).map(([roleKey, icon]) => (
          <option key={roleKey} value={roleKey} className="text-base">
            {icon}
          </option>
        ))}
      </select>
    </div>
  );
}; 