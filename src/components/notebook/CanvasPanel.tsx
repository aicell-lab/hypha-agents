import React from 'react';
import { Splitter } from './Splitter';
import { VscCode } from 'react-icons/vsc';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { TbLayoutBoard } from 'react-icons/tb';

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

// Memoize the iframe to prevent re-renders
const MemoizedIframe: React.FC<{ src: string; id: string; name: string }> = React.memo(({ src, id, name }) => (
  <iframe
    src={src}
    id={id}
    className="w-full h-full border-none"
    title={name || 'Untitled'}
  />
));

MemoizedIframe.displayName = 'MemoizedIframe';

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
  const [isMobile, setIsMobile] = React.useState(false);
  const [isHidden, setIsHidden] = React.useState(false);
  
  // Use ref to store windows to prevent unnecessary re-renders
  const windowsRef = React.useRef<HyphaCoreWindow[]>([]);
  React.useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  // Check for mobile and very small screen size
  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsHidden(window.innerWidth <= 480);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleTabClose = React.useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose?.(tabId);
  }, [onTabClose]);

  // Get first letter of window name for icon
  const getWindowIcon = React.useCallback((name: string) => {
    return (name || 'Untitled').charAt(0).toUpperCase();
  }, []);

  // Style for container visibility
  const containerStyle = React.useMemo(() => ({
    width: isVisible ? (isMobile ? '100%' : width) : '36px',
    maxWidth: '100vw',
    opacity: 1,
    visibility: 'visible' as const,
    transition: 'width 300ms ease-in-out'
  }), [isVisible, width, isMobile]);

  // Render collapsed view with icons
  const renderCollapsedView = () => (
    <div className="bg-white flex flex-col rounded-l-lg relative overflow-visible">
      {/* Canvas button at the top */}
      <button
        onClick={onClose}
        className="w-9 h-9 mx-auto flex items-center justify-center transition-colors bg-blue-100 text-gray-600 hover:bg-blue-200"
        title="Open Canvas Panel"
      >
        <TbLayoutBoard className="w-5 h-5" />
      </button>

      {/* Rotated text label - only show when no windows */}
      {windows.length < 4 && (
        <div className="flex justify-center mb-12 mt-10">
          <span className="transform rotate-90 text-gray-500 text-sm font-medium block whitespace-nowrap">
            Canvas Panel
          </span>
        </div>
      )}

      {/* Separator */}
      <div className="w-6 h-px bg-gray-200 mx-auto mb-4"></div>

      {/* Scrollable window icons */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {windows.map(window => (
          <button
            key={window.id}
            onClick={() => {
              onTabChange(window.id);
              setTimeout(() => onClose(), 0);
            }}
            className={`w-9 h-9 mb-1 mx-auto flex items-center justify-center transition-colors rounded-lg ${
              activeTab === window.id
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={window.name || 'Untitled'}
          >
            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
              {getWindowIcon(window.name || '')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  // Render expanded view with content
  const renderExpandedView = () => (
    <>
      {/* Only show splitter on md and larger screens */}
      <div className="hidden md:block">
        <Splitter 
          onResize={onResize} 
          onResizeStart={() => setIsResizing(true)} 
          onResizeEnd={() => setIsResizing(false)} 
        />
      </div>

      {/* Overlay to prevent iframe from capturing events during resize */}
      {isResizing && (
        <div 
          className="absolute inset-0 z-50 bg-transparent"
          style={{ cursor: 'col-resize' }}
        />
      )}

      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-2 sticky top-0 z-10">
        <div className="flex-1 flex space-x-2 overflow-x-auto scrollbar-hide">
          {windows.length > 0 ? (
            windows.map(window => (
              <button
                key={window.id}
                onClick={() => onTabChange(window.id)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 group ${
                  activeTab === window.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="truncate max-w-[150px]">{window.name || 'Untitled'}</span>
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
            ))
          ) : (
            <span className="text-sm text-gray-500 px-3 py-1">Canvas Panel</span>
          )}
        </div>
        <div className="flex items-center ml-2">
          {/* Back to notebook button on small screens */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 mr-2 hover:bg-gray-200 rounded-md text-gray-600"
            title="Back to notebook"
          >
            <FaChevronRight className="w-5 h-5" />
          </button>
          {/* Collapse button on larger screens */}
          <button
            onClick={onClose}
            className="hidden md:block p-1 hover:bg-gray-200 rounded-md flex-shrink-0"
            title="Collapse panel"
          >
            <FaChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {windows.length > 0 ? (
          windows.map(window => (
            <div
              key={window.id}
              className="absolute inset-0"
              style={{ 
                // Keep iframes mounted but hidden to preserve state
                display: activeTab === window.id ? 'block' : 'none',
                visibility: activeTab === window.id ? 'visible' : 'hidden'
              }}
            >
              <MemoizedIframe
                src={window.src}
                id={window.id}
                name={window.name || 'Untitled'}
              />
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 relative p-4">
            {/* Empty state content */}
            <div className="text-center mb-4">
              <svg 
                className="w-24 h-24 mx-auto text-gray-300" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M9 17h6m-3-3v3M3 8V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" 
                />
              </svg>
              <h3 className="text-lg font-medium mt-4 text-gray-600">No Windows Open</h3>
            </div>

            {/* Tip Box */}
            <div className="w-full max-w-md mt-4">
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
                <div className="flex items-start">
                  <HiOutlineLightBulb className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <div className="text-sm text-blue-800 font-medium mb-1">Create a ImJoy plugin window using Python:</div>
                    <code className="text-xs bg-blue-100/50 px-2 py-1 rounded font-mono text-blue-700 block overflow-x-auto">
                      viewer = await api.createWindow(src="https://kaibu.org")
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Floating button for very small screens */}
      {isHidden && !isVisible && (
        <button
          onClick={onClose}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-white shadow-lg rounded-l-lg p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-colors"
          title="Open canvas panel"
        >
          <TbLayoutBoard className="w-4 h-4" />
        </button>
      )}

      <div 
        className={`h-full flex flex-col bg-white border-l border-gray-200 ${
          isVisible ? 'fixed md:relative inset-0 md:inset-auto' : 'fixed right-0'
        } z-30 ${isHidden && !isVisible ? 'hidden' : ''}`}
        style={containerStyle}
      >
        {/* Always render both views, use CSS to control visibility */}
        <div style={{ display: isVisible ? 'none' : 'block' }}>
          {!isHidden && renderCollapsedView()}
        </div>
        <div 
          className="flex flex-col h-full"
          style={{ 
            display: isVisible ? 'flex' : 'none',
            height: isVisible ? '100%' : '0',
            overflow: 'hidden'
          }}
        >
          {renderExpandedView()}
        </div>
      </div>
    </>
  );
};
