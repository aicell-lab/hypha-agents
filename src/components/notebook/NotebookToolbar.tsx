import React, { useState } from 'react';
import { FaPlay, FaTrash, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner, FaBars, FaCircle, FaExclamationTriangle } from 'react-icons/fa';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';
import { RiRobot2Line } from 'react-icons/ri';
import { TbLayoutSidebarRightExpand } from 'react-icons/tb';
import LoginButton from '../LoginButton';
import { NotebookMetadata } from '../../types/notebook';

// Kernel status type
type KernelStatus = 'idle' | 'busy' | 'starting' | 'error';

// Kernel Status Indicator Component
interface KernelStatusIndicatorProps {
  status: KernelStatus;
  isReady: boolean;
  compact?: boolean;
  onRetry?: () => void;
}

const KernelStatusIndicator: React.FC<KernelStatusIndicatorProps> = ({ 
  status, 
  isReady, 
  compact = false,
  onRetry
}) => {
  const getStatusInfo = () => {
    if (!isReady) {
      return {
        color: 'text-gray-800',
        bgColor: 'bg-gray-100',
        icon: <FaSpinner className="w-3 h-3 animate-spin" />,
        text: 'Initializing...',
        dot: 'bg-gray-600',
        clickable: false
      };
    }
    
    switch (status) {
      case 'busy':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          icon: <FaSpinner className="w-3 h-3 animate-spin" />,
          text: 'Busy',
          dot: 'bg-yellow-500',
          clickable: false
        };
      case 'error':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50 hover:bg-red-100',
          icon: <FaExclamationTriangle className="w-3 h-3" />,
          text: 'Error - Click to retry',
          dot: 'bg-red-500',
          clickable: true
        };
      case 'starting':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          icon: <FaSpinner className="w-3 h-3 animate-spin" />,
          text: 'Starting...',
          dot: 'bg-blue-500',
          clickable: false
        };
      case 'idle':
      default:
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: <FaCircle className="w-2 h-2" />,
          text: 'Ready',
          dot: 'bg-green-500',
          clickable: false
        };
    }
  };

  const { color, bgColor, icon, text, dot, clickable } = getStatusInfo();

  const handleClick = () => {
    if (clickable && onRetry) {
      onRetry();
    }
  };

  if (compact) {
    return (
      <div 
        className={`flex items-center gap-1 px-2 py-1 rounded-full ${bgColor} ${color} text-xs ${clickable ? 'cursor-pointer transition-colors' : ''}`}
        title={`Kernel ${text}`}
        onClick={handleClick}
      >
        <div className={`w-2 h-2 rounded-full ${dot}`}></div>
        <span className="hidden sm:inline">{status === 'error' ? 'Error' : text}</span>
        {status === 'error' && (
          <FaRedo className="w-2 h-2 ml-1 opacity-70" />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-1.5 px-2 py-1 rounded ${bgColor} ${color} text-xs ${clickable ? 'cursor-pointer transition-colors' : ''}`}
      title={`Kernel ${text}`}
      onClick={handleClick}
    >
      {icon}
      <span className="hidden md:inline">{status === 'error' ? 'Error' : text}</span>
      {status === 'error' && (
        <FaRedo className="w-3 h-3 ml-1 opacity-70" />
      )}
    </div>
  );
};

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
  kernelStatus: KernelStatus;
  onRetryKernel?: () => void;
}

export const KernelControls: React.FC<KernelControlsProps> = ({
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  isProcessing,
  isReady,
  kernelStatus,
  onRetryKernel
}) => (
  <div className="flex items-center gap-1">
    <KernelStatusIndicator 
      status={kernelStatus} 
      isReady={isReady} 
      compact={true}
      onRetry={onRetryKernel || onRestartKernel}
    />
    <div className="h-4 w-px bg-gray-200 mx-1"></div>
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
      disabled={isProcessing || (kernelStatus !== 'error' && !isReady)}
    >
      <FaRedo className={`w-3.5 h-3.5 ${(isProcessing || (kernelStatus !== 'error' && !isReady)) ? 'opacity-50' : ''}`} />
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
  onPublish?: () => void;
  isWelcomeScreen?: boolean;
  kernelStatus: KernelStatus;
  onRetryKernel?: () => void;
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
  onClose,
  isWelcomeScreen,
  kernelStatus,
  onRetryKernel
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
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-sm text-gray-700">Status:</span>
          <KernelStatusIndicator 
            status={kernelStatus} 
            isReady={isKernelReady} 
            compact={false}
            onRetry={onRetryKernel || onRestartKernel}
          />
        </div>
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
          disabled={isProcessing || (kernelStatus !== 'error' && !isKernelReady)}
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
  isSidebarOpen,
  isWelcomeScreen = false,
  kernelStatus,
  onRetryKernel
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
      {!isWelcomeScreen && (
        <>          
          <KernelControls 
            onRunAll={onRunAll} 
            onClearOutputs={onClearOutputs} 
            onRestartKernel={onRestartKernel} 
            isProcessing={isProcessing} 
            isReady={isKernelReady} 
            kernelStatus={kernelStatus}
            onRetryKernel={onRetryKernel}
          />
          <div className="h-5 w-px bg-gray-200 mx-1"></div>
          <FileOperations 
            onSave={onSave} 
            onDownload={onDownload} 
            onLoad={onLoad} 
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
        </>
      )}
      <LoginSection />
    </div>
  );

  // Render dropdown for smaller screens
  const renderDropdownToolbar = () => (
    <div className="relative">
      {!isWelcomeScreen ? (
        <>
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
            isWelcomeScreen={isWelcomeScreen}
            kernelStatus={kernelStatus}
            onRetryKernel={onRetryKernel}
          />
        </>
      ) : (
        <LoginSection />
      )}
    </div>
  );

  return (
    <div className="flex items-center justify-end flex-grow px-2">
      {isMobile ? renderDropdownToolbar() : renderStandardToolbar()}
    </div>
  );
};

export { NotebookToolbar as default }; 