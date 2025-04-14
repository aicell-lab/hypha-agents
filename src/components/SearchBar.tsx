import React, { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';

interface SearchBarProps {
  onSearchChange: (value: string) => void;
  onSearchConfirm: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearchChange, onSearchConfirm }) => {
  const [searchValue, setSearchValue] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearchChange(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchConfirm(searchValue);
    }
  };

  return (
    <div className="max-w-2xl mx-auto m-4">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search resources..."
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

export default SearchBar; 