import React, { useState } from 'react';
import { FaPlay, FaTrash, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner, FaBars } from 'react-icons/fa';
import { AiOutlinePlus } from 'react-icons/ai';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';
import { RiRobot2Line } from 'react-icons/ri';
import { TbLayoutSidebarRightExpand } from 'react-icons/tb';
import LoginButton from '../LoginButton';

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
  onToggleCanvasPanel: () => void;
  showCanvasPanel: boolean;
}

export const CellControls: React.FC<CellControlsProps> = ({
  onAddCodeCell,
  onAddMarkdownCell,
  onShowKeyboardShortcuts,
  onToggleCanvasPanel,
  showCanvasPanel
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
    <button
      onClick={onToggleCanvasPanel}
      className={`p-1.5 hover:bg-gray-100 rounded transition flex items-center ${showCanvasPanel ? 'text-blue-600' : 'text-gray-500'}`}
      title={`${showCanvasPanel ? 'Hide' : 'Show'} canvas panel`}
    >
      <TbLayoutSidebarRightExpand className="w-3.5 h-3.5" />
    </button>
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
  <div className="flex items-center ml-1 border-l border-gray-200 pl-1">
    <LoginButton className="scale-75 z-100" />
  </div>
);

interface NotebookToolbarProps {
  onSave: () => void;
  onDownload: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRunAll: () => void;
  onClearOutputs: () => void;
  onRestartKernel: () => void;
  onAddCodeCell: () => void;
  onAddMarkdownCell: () => void;
  onShowKeyboardShortcuts: () => void;
  onToggleCanvasPanel: () => void;
  showCanvasPanel: boolean;
  isProcessing: boolean;
  isReady: boolean;
}

interface ToolbarDropdownProps {
  onSave: () => void;
  onDownload: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRunAll: () => void;
  onClearOutputs: () => void;
  onRestartKernel: () => void;
  onAddCodeCell: () => void;
  onAddMarkdownCell: () => void;
  onShowKeyboardShortcuts: () => void;
  onToggleCanvasPanel: () => void;
  showCanvasPanel: boolean;
  isProcessing: boolean;
  isReady: boolean;
}

const ToolbarDropdown: React.FC<ToolbarDropdownProps> = ({
  onSave,
  onDownload,
  onLoad,
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  onAddCodeCell,
  onAddMarkdownCell,
  onShowKeyboardShortcuts,
  onToggleCanvasPanel,
  showCanvasPanel,
  isProcessing,
  isReady
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
        title="Menu"
      >
        <FaBars className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg z-50 py-1 border border-gray-200">
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
            onChange={onLoad}
            className="hidden"
            id="notebook-file-mobile"
          />
          <button
            onClick={onSave}
            className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <FaSave className="w-3.5 h-3.5 mr-2" />
            Save
          </button>
          <button
            onClick={onDownload}
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
              disabled={!isReady || isProcessing}
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
            <button
              onClick={onToggleCanvasPanel}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <TbLayoutSidebarRightExpand className="w-3.5 h-3.5 mr-2" />
              {showCanvasPanel ? 'Hide' : 'Show'} Canvas
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const NotebookToolbar: React.FC<NotebookToolbarProps> = ({
  onSave,
  onDownload,
  onLoad,
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  onAddCodeCell,
  onAddMarkdownCell,
  onShowKeyboardShortcuts,
  onToggleCanvasPanel,
  showCanvasPanel,
  isProcessing,
  isReady
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="flex items-center justify-between px-2 py-1 border-b border-gray-200 bg-white">
      {/* Desktop toolbar - hidden on small screens */}
      <div className="hidden md:flex items-center space-x-2 flex-1">
        <FileOperations onSave={onSave} onDownload={onDownload} onLoad={onLoad} />
        <KernelControls
          onRunAll={onRunAll}
          onClearOutputs={onClearOutputs}
          onRestartKernel={onRestartKernel}
          isProcessing={isProcessing}
          isReady={isReady}
        />
        <CellControls
          onAddCodeCell={onAddCodeCell}
          onAddMarkdownCell={onAddMarkdownCell}
          onShowKeyboardShortcuts={onShowKeyboardShortcuts}
          onToggleCanvasPanel={onToggleCanvasPanel}
          showCanvasPanel={showCanvasPanel}
        />
        <LoginSection />
      </div>

      {/* Mobile toolbar */}
      <div className="md:hidden flex items-center justify-between w-full">
        {/* Essential buttons always visible on mobile */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onAddCodeCell}
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition flex items-center"
            title="Add code cell"
          >
            <VscCode className="w-3.5 h-3.5" />
            <AiOutlinePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRunAll}
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
            title="Run all cells"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <FaSpinner className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FaPlay className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
            title="Toggle menu"
          >
            <FaBars className="w-4 h-4" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg z-50 py-1 border border-gray-200">
              <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200">File</div>
              <button
                onClick={() => {
                  onSave();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Save Notebook
              </button>
              <button
                onClick={() => {
                  onDownload();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Download Notebook
              </button>
              <label
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 block cursor-pointer"
                onClick={() => setIsDropdownOpen(false)}
              >
                Open Notebook
                <input
                  type="file"
                  accept=".ipynb"
                  onChange={(e) => {
                    onLoad(e);
                    setIsDropdownOpen(false);
                  }}
                  className="hidden"
                />
              </label>

              <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200 mt-2">Cells</div>
              <button
                onClick={() => {
                  onAddMarkdownCell();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Add Markdown Cell
              </button>
              <button
                onClick={() => {
                  onClearOutputs();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Clear All Outputs
              </button>
              <button
                onClick={() => {
                  onRestartKernel();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                disabled={!isReady || isProcessing}
              >
                Restart Kernel
              </button>

              <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200 mt-2">View</div>
              <button
                onClick={() => {
                  onToggleCanvasPanel();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {showCanvasPanel ? 'Hide' : 'Show'} Canvas
              </button>
              <button
                onClick={() => {
                  onShowKeyboardShortcuts();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Keyboard Shortcuts
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { NotebookToolbar as default }; 