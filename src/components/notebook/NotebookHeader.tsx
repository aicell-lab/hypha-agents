import React from 'react';
import { Link } from 'react-router-dom';
import { NotebookToolbar } from './NotebookToolbar';
import { NotebookMetadata } from '../../types/notebook';
import { FaBars } from 'react-icons/fa';

interface NotebookHeaderProps {
  metadata: NotebookMetadata;
  fileName: string;
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
  isProcessing: boolean;
  isKernelReady: boolean;
  isAIReady: boolean;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const NotebookHeader: React.FC<NotebookHeaderProps> = ({
  metadata,
  fileName,
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
  isProcessing,
  isKernelReady,
  isAIReady,
  onToggleSidebar,
  isSidebarOpen
}) => {
  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-full mx-auto flex items-center justify-between">
        {/* Logo and Titles */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition"
            title="Toggle sidebar"
          >
            <FaBars className="w-4 h-4" />
          </button>
          <Link
            to="/"
            className="flex items-center hover:opacity-80 transition"
            title="Go to Home"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 24 24"
              className="h-8 w-8 text-blue-600"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="m21.406 6.086-9-4a1.001 1.001 0 0 0-.813 0l-9 4c-.02.009-.034.024-.054.035-.028.014-.058.023-.084.04-.022.015-.039.034-.06.05a.87.87 0 0 0-.19.194c-.02.028-.041.053-.059.081a1.119 1.119 0 0 0-.076.165c-.009.027-.023.052-.031.079A1.013 1.013 0 0 0 2 7v10c0 .396.232.753.594.914l9 4c.13.058.268.086.406.086a.997.997 0 0 0 .402-.096l.004.01 9-4A.999.999 0 0 0 22 17V7a.999.999 0 0 0-.594-.914zM12 4.095 18.538 7 12 9.905l-1.308-.581L5.463 7 12 4.095zM4 16.351V8.539l7 3.111v7.811l-7-3.11zm9 3.11V11.65l7-3.111v7.812l-7 3.11z"></path>
            </svg>
          </Link>
          {/* Always show Agent Lab */}
          <h1 className="text-base font-medium text-gray-900">Agent Lab</h1>
          {/* Show file name on medium and larger screens */}
          <div className="hidden md:flex items-center">
            <div className="h-5 w-px bg-gray-200 mx-1"></div>
            <span
              className="text-lg font-medium bg-transparent border-none px-1 text-gray-600 truncate max-w-xs inline-block"
              title={fileName}
            >
              {fileName || 'Untitled_Chat'}
            </span>
          </div>
        </div>

        <NotebookToolbar
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
          isProcessing={isProcessing}
          isKernelReady={isKernelReady}
          isAIReady={isAIReady}
          onToggleSidebar={onToggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
      </div>
    </div>
  );
};

export default NotebookHeader; 