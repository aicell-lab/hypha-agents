import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NotebookToolbar } from './NotebookToolbar';
import { NotebookMetadata } from '../../types/notebook';
import { FaBars } from 'react-icons/fa';

export interface NotebookHeaderProps {
  metadata: NotebookMetadata;
  fileName: string;
  onMetadataChange: (metadata: NotebookMetadata) => void;
  onSave: () => void;
  onDownload: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMountDirectory?: () => void;
  onShowEnvironmentInfo?: () => void;
  onRunAll: () => void;
  onClearOutputs: () => void;
  onRestartKernel: () => void;
  onInterruptKernel?: () => Promise<void>;
  onAddCodeCell: () => void;
  onAddMarkdownCell: () => void;
  onShowKeyboardShortcuts: () => void;
  isProcessing: boolean;
  isKernelReady: boolean;
  isAIReady: boolean;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onMoveCellUp: () => void;
  onMoveCellDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isWelcomeScreen?: boolean;
  kernelStatus: 'idle' | 'busy' | 'starting' | 'error';
  onRetryKernel?: () => void;
}

const NotebookHeader: React.FC<NotebookHeaderProps> = ({
  metadata,
  fileName,
  onMetadataChange,
  onSave,
  onDownload,
  onLoad,
  onMountDirectory,
  onShowEnvironmentInfo,
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  onInterruptKernel,
  onAddCodeCell,
  onAddMarkdownCell,
  onShowKeyboardShortcuts,
  isProcessing,
  isKernelReady,
  isAIReady,
  onToggleSidebar,
  isSidebarOpen,
  onMoveCellUp,
  onMoveCellDown,
  canMoveUp,
  canMoveDown,
  isWelcomeScreen = false,
  kernelStatus,
  onRetryKernel,
}) => {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 shadow-sm">
      <div className="max-w-full mx-auto flex items-center justify-between h-10">
        {/* Logo and Titles */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-white/70 rounded transition"
            title="Toggle sidebar"
          >
            <FaBars className="w-4 h-4" />
          </button>
          <Link
            to="/"
            className="flex items-center hover:opacity-80 transition"
            title="Go to Home"
          >
            <img 
              src="/logo.png" 
              alt="Hypha Agents" 
              className="h-6 w-6"
            />
          </Link>
          {/* Always show Agent Lab */}
          <h1 className="text-base font-medium text-gray-800">Agent Lab</h1>
          {/* Show file name on medium and larger screens, but not on welcome screen */}
          {!isWelcomeScreen && (
            <div className="hidden md:flex items-center">
              <div className="h-5 w-px bg-blue-100 mx-1"></div>
              <span
                className="text-lg font-medium bg-transparent border-none px-1 text-gray-600 truncate max-w-xs inline-block"
                title={fileName}
              >
                {fileName || 'Untitled_Chat'}
              </span>
            </div>
          )}
        </div>

        <NotebookToolbar
          metadata={metadata}
          onMetadataChange={onMetadataChange}
          onSave={onSave}
          onDownload={onDownload}
          onLoad={onLoad}
          onMountDirectory={onMountDirectory}
          onShowEnvironmentInfo={onShowEnvironmentInfo}
          onRunAll={onRunAll}
          onClearOutputs={onClearOutputs}
          onRestartKernel={onRestartKernel}
          onInterruptKernel={onInterruptKernel}
          onAddCodeCell={onAddCodeCell}
          onAddMarkdownCell={onAddMarkdownCell}
          onShowKeyboardShortcuts={onShowKeyboardShortcuts}
          isProcessing={isProcessing}
          isKernelReady={isKernelReady}
          isAIReady={isAIReady}
          onToggleSidebar={onToggleSidebar}
          isSidebarOpen={isSidebarOpen}
          onMoveCellUp={onMoveCellUp}
          onMoveCellDown={onMoveCellDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          isWelcomeScreen={isWelcomeScreen}
          kernelStatus={kernelStatus}
          onRetryKernel={onRetryKernel}
        />
      </div>
    </div>
  );
};

export default NotebookHeader; 