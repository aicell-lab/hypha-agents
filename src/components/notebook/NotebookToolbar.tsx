import React from 'react';
import { FaPlay, FaTrash, FaKeyboard, FaSave, FaFolder, FaDownload, FaRedo, FaSpinner } from 'react-icons/fa';
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
}) => (
  <div className="flex items-center gap-1">
    <div className="flex items-center">
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
    </div>
    <div className="border-l border-gray-200 pl-1">
      <FileOperations onSave={onSave} onDownload={onDownload} onLoad={onLoad} />
    </div>
    <KernelControls
      onRunAll={onRunAll}
      onClearOutputs={onClearOutputs}
      onRestartKernel={onRestartKernel}
      isProcessing={isProcessing}
      isReady={isReady}
    />
    <div className="flex items-center ml-1 border-l border-gray-200 pl-1">
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
    <LoginSection />
  </div>
); 