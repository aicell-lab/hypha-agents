import React, { useState } from 'react';
import { FaPlay, FaTrash, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner, FaBars } from 'react-icons/fa';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';
import { RiRobot2Line } from 'react-icons/ri';
import { TbLayoutSidebarRightExpand } from 'react-icons/tb';
import LoginButton from '../LoginButton';
import { NotebookMetadata } from '../../types/notebook';

interface FileOperationsProps {
  onSave: () => void;
  onDownload: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileOperations: React.FC<FileOperationsProps> = ({ onSave, onDownload, onLoad }) => (
  <div className="flex items-center">
    <input
      type="file"
      accept=".ipynb"
      onChange={onLoad}
      className="hidden"
      id="notebook-file"
      aria-label="Open notebook file"
    />
    <label
      htmlFor="notebook-file"
      className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition cursor-pointer flex items-center"
      title="Open notebook"
    >
      <FaFolder className="w-3.5 h-3.5" />
    </label>
    <button
      onClick={onSave}
      className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
      title="Save notebook (Ctrl/Cmd + S)"
    >
      <FaSave className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={onDownload}
      className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
      title="Download notebook (Ctrl/Cmd + Shift + S)"
    >
      <FaDownload className="w-3.5 h-3.5" />
    </button>
  </div>
);

interface KernelControlsProps {
  onRunAll: () => void;
  onClearOutputs: () => void;
  onRestartKernel: () => void;
  isProcessing: boolean;
  isReady: boolean;
}

export const KernelControls: React.FC<KernelControlsProps> = ({
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  isProcessing,
  isReady
}) => (
  <div className="flex items-center">
    <button
      onClick={onRunAll}
      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
      title="Run all cells (Ctrl/Cmd + Shift + Enter)"
      disabled={isProcessing}
    >
      {isProcessing ? (
        <FaSpinner className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FaPlay className="w-3.5 h-3.5" />
      )}
    </button>
    <button
      onClick={onClearOutputs}
      className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
      title="Clear all outputs"
      disabled={isProcessing}
    >
      <FaTrash className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={onRestartKernel}
      className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition group relative"
      title="Restart kernel and clear outputs"
      disabled={!isReady || isProcessing}
    >
      <FaRedo className={`w-3.5 h-3.5 ${(!isReady || isProcessing) ? 'opacity-50' : ''}`} />
    </button>
  </div>
);

interface CellControlsProps {
  onAddCodeCell: () => void;
  onAddMarkdownCell: () => void;
  onShowKeyboardShortcuts: () => void;
  onMoveCellUp?: () => void;
  onMoveCellDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const CellControls: React.FC<CellControlsProps> = ({
  onAddCodeCell,
  onAddMarkdownCell,
  onShowKeyboardShortcuts,
  onMoveCellUp,
  onMoveCellDown,
  canMoveUp,
  canMoveDown
}) => (
  <div className="flex items-center ml-1 border-l border-gray-200 pl-1">
    <button 
      onClick={onAddCodeCell}
      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition flex items-center"
      title="Add code cell (Ctrl/Cmd + B)"
    >
      <VscCode className="w-3.5 h-3.5" />
      <AiOutlinePlus className="w-3.5 h-3.5" />
    </button>
    <button 
      onClick={onAddMarkdownCell}
      className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition flex items-center"
      title="Add markdown cell"
    >
      <MdOutlineTextFields className="w-3.5 h-3.5" />
      <AiOutlinePlus className="w-3.5 h-3.5" />
    </button>
    <div className="flex items-center ml-1 border-l border-gray-200 pl-1">
      <button
        onClick={onMoveCellUp}
        disabled={!canMoveUp}
        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        title="Move cell up"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        onClick={onMoveCellDown}
        disabled={!canMoveDown}
        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        title="Move cell down"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    <button
      onClick={onShowKeyboardShortcuts}
      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition ml-1"
      title="Keyboard Shortcuts"
    >
      <FaKeyboard className="w-3.5 h-3.5" />
    </button>
  </div>
);

export const LoginSection: React.FC = () => (
  <div className="flex items-center ml-1 border-l border-gray-200 pl-1 z-10">
    <LoginButton className="scale-75" />
  </div>
);

export interface NotebookToolbarProps {
  metadata: NotebookMetadata;
  onMetadataChange: (metadata: NotebookMetadata) => void;
  onSave: () => void;
  onDownload: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRunAll: () => void;
  onClearOutputs: () => void;
  onRestartKernel: () => void;
  onAddCodeCell: () => void;
  onAddMarkdownCell: () => void;
  onShowKeyboardShortcuts: () => void;
  onMoveCellUp?: () => void;
  onMoveCellDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isProcessing: boolean;
  isKernelReady: boolean;
  isAIReady: boolean;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

interface ToolbarDropdownProps extends Omit<NotebookToolbarProps, 'onPublish'> {
  isOpen: boolean;
  onClose: () => void;
}

const ToolbarDropdown: React.FC<ToolbarDropdownProps> = ({
  metadata,
  onMetadataChange,
  onSave,
  onDownload,
  onLoad,
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  onAddCodeCell,
  onAddMarkdownCell,
  onShowKeyboardShortcuts,
  onMoveCellUp,
  onMoveCellDown,
  canMoveUp,
  canMoveDown,
  isProcessing,
  isKernelReady,
  isAIReady,
  onToggleSidebar,
  isSidebarOpen,
  isOpen,
  onClose
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(metadata.title || 'Untitled Chat');

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTempTitle(metadata.title || 'Untitled Chat');
  };

  const handleTitleSave = () => {
    onMetadataChange({
      ...metadata,
      title: tempTitle || 'Untitled Chat',
      modified: new Date().toISOString()
    });
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTempTitle(metadata.title || 'Untitled Chat');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-md shadow-lg z-50 py-1 border border-gray-200">
      {/* Title Section - Only visible on mobile */}
      <div className="md:hidden px-2 py-2 border-b border-gray-200">
        {isEditingTitle ? (
          <div className="flex items-center">
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
              className="flex-1 text-sm px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              aria-label="Notebook title"
              placeholder="Enter notebook title"
            />
          </div>
        ) : (
          <button
            onClick={handleTitleClick}
            className="w-full text-left px-2 py-1 text-sm text-gray-900 hover:bg-gray-100 rounded"
          >
            <div className="font-medium truncate">{metadata.title || 'Untitled Chat'}</div>
            <div className="text-xs text-gray-500">Click to rename</div>
          </button>
        )}
      </div>

      {/* Rest of the menu items */}
      <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200">View</div>
      <button
        onClick={() => {
          onToggleSidebar();
          onClose();
        }}
        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        <FaBars className="w-3.5 h-3.5 mr-2" />
        {isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
      </button>

      <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200">File Operations</div>
      <label
        htmlFor="notebook-file-mobile"
        className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
      >
        <FaFolder className="w-3.5 h-3.5 mr-2" />
        Open
      </label>
      <input
        type="file"
        accept=".ipynb"
        onChange={(e) => {
          onLoad(e);
          onClose();
        }}
        className="hidden"
        id="notebook-file-mobile"
      />
      <button
        onClick={() => {
          onSave();
          onClose();
        }}
        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        <FaSave className="w-3.5 h-3.5 mr-2" />
        Save
      </button>
      <button
        onClick={() => {
          onDownload();
          onClose();
        }}
        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        <FaDownload className="w-3.5 h-3.5 mr-2" />
        Download
      </button>

      <div className="border-t border-gray-200 mt-1 pt-1">
        <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200">Cells</div>
        <button
          onClick={onAddCodeCell}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <VscCode className="w-3.5 h-3.5 mr-2" />
          Add Code Cell
        </button>
        <button
          onClick={onAddMarkdownCell}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <MdOutlineTextFields className="w-3.5 h-3.5 mr-2" />
          Add Markdown Cell
        </button>
        <button
          onClick={onMoveCellUp}
          disabled={!canMoveUp}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          Move Cell Up
        </button>
        <button
          onClick={onMoveCellDown}
          disabled={!canMoveDown}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Move Cell Down
        </button>
      </div>

      <div className="border-t border-gray-200 mt-1 pt-1">
        <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200">Kernel</div>
        <button
          onClick={onRunAll}
          disabled={isProcessing}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {isProcessing ? (
            <FaSpinner className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <FaPlay className="w-3.5 h-3.5 mr-2" />
          )}
          Run All
        </button>
        <button
          onClick={onClearOutputs}
          disabled={isProcessing}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          <FaTrash className="w-3.5 h-3.5 mr-2" />
          Clear Outputs
        </button>
        <button
          onClick={onRestartKernel}
          disabled={!isKernelReady || isProcessing}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          <FaRedo className="w-3.5 h-3.5 mr-2" />
          Restart Kernel
        </button>
      </div>

      <div className="border-t border-gray-200 mt-1 pt-1">
        <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200">Other</div>
        <button
          onClick={onShowKeyboardShortcuts}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <FaKeyboard className="w-3.5 h-3.5 mr-2" />
          Keyboard Shortcuts
        </button>
      </div>
    </div>
  );
};

export const NotebookToolbar: React.FC<NotebookToolbarProps> = ({
  metadata,
  onMetadataChange,
  onSave,
  onDownload,
  onLoad,
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  onAddCodeCell,
  onAddMarkdownCell,
  onShowKeyboardShortcuts,
  onMoveCellUp,
  onMoveCellDown,
  canMoveUp,
  canMoveDown,
  isProcessing,
  isKernelReady,
  isAIReady,
  onToggleSidebar,
  isSidebarOpen
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize
  const handleResize = () => {
    setIsMobile(window.innerWidth < 768);
  };

  // Render standard toolbar for larger screens
  const renderStandardToolbar = () => (
    <div className="flex items-center">
      <FileOperations 
        onSave={onSave} 
        onDownload={onDownload} 
        onLoad={onLoad} 
      />
      <div className="h-5 w-px bg-gray-200 mx-1"></div>
      <KernelControls 
        onRunAll={onRunAll} 
        onClearOutputs={onClearOutputs} 
        onRestartKernel={onRestartKernel} 
        isProcessing={isProcessing} 
        isReady={isKernelReady} 
      />
      <CellControls 
        onAddCodeCell={onAddCodeCell} 
        onAddMarkdownCell={onAddMarkdownCell} 
        onShowKeyboardShortcuts={onShowKeyboardShortcuts}
        onMoveCellUp={onMoveCellUp}
        onMoveCellDown={onMoveCellDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
      <LoginSection />
    </div>
  );

  // Render dropdown for smaller screens
  const renderDropdownToolbar = () => (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
        title="Toggle menu"
      >
        <FaBars className="w-4 h-4" />
      </button>

      <ToolbarDropdown
        metadata={metadata}
        onMetadataChange={onMetadataChange}
        onSave={onSave}
        onDownload={onDownload}
        onLoad={onLoad}
        onRunAll={onRunAll}
        onClearOutputs={onClearOutputs}
        onRestartKernel={onRestartKernel}
        onAddCodeCell={onAddCodeCell}
        onAddMarkdownCell={onAddMarkdownCell}
        onShowKeyboardShortcuts={onShowKeyboardShortcuts}
        onMoveCellUp={onMoveCellUp}
        onMoveCellDown={onMoveCellDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        isProcessing={isProcessing}
        isKernelReady={isKernelReady}
        isAIReady={isAIReady}
        onToggleSidebar={onToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
      />
    </div>
  );

  return (
    <div className="flex items-center justify-end flex-grow px-2">
      {isMobile ? renderDropdownToolbar() : renderStandardToolbar()}
    </div>
  );
};

export { NotebookToolbar as default }; 