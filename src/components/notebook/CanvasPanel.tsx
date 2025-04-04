import React from 'react';
import { Splitter } from './Splitter';

interface HyphaCoreWindow {
  id: string;
  src: string;
  name?: string;
}

interface CanvasPanelProps {
  windows: HyphaCoreWindow[];
  isVisible: boolean;
  width: number;
  activeTab: string | null;
  onResize: (newWidth: number) => void;
  onClose: () => void;
  onTabChange: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  windows,
  isVisible,
  width,
  activeTab,
  onResize,
  onClose,
  onTabChange,
  onTabClose
}) => {
  const [isResizing, setIsResizing] = React.useState(false);

  if (!isVisible) return null;

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose?.(tabId);
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 relative">
      <Splitter 
        onResize={onResize} 
        onResizeStart={() => setIsResizing(true)} 
        onResizeEnd={() => setIsResizing(false)} 
      />

      {/* Overlay to prevent iframe from capturing events during resize */}
      {isResizing && (
        <div 
          className="absolute inset-0 z-50 bg-transparent"
          style={{ cursor: 'col-resize' }}
        />
      )}

      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-2">
        <div className="flex space-x-2 overflow-x-auto">
          {windows.map(window => (
            <button
              key={window.id}
              onClick={() => onTabChange(window.id)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 group ${
                activeTab === window.id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{window.name}</span>
              {onTabClose && (
                <span
                  onClick={(e) => handleTabClose(e, window.id)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded-full p-1 transition-opacity"
                >
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded-md flex-shrink-0"
          title="Close panel"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {windows.map(window => (
          <div
            key={window.id}
            className={`w-full h-full ${activeTab === window.id ? 'block' : 'hidden'}`}
          >
            <iframe
              src={window.src}
              id={window.id}
              className="w-full h-full border-none"
              title={window.name}
            />
          </div>
        ))}
      </div>
    </div>
  );
}; 