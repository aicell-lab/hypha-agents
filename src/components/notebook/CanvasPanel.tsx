import React from 'react';
import { Splitter } from './Splitter';
import { VscCode } from 'react-icons/vsc';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { TbLayoutBoard } from 'react-icons/tb';

export interface HyphaCoreWindow {
  id: string;
  src?: string;
  component?: React.ReactNode;
  name?: string;
}

interface CanvasPanelProps {
  windows: HyphaCoreWindow[];
  isVisible: boolean;
  activeTab: string | null;
  onResize?: (newWidth: number) => void;
  onClose: () => void;
  onTabChange: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  defaultWidth?: number;
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
  activeTab,
  onResize,
  onClose,
  onTabChange,
  onTabClose,
  defaultWidth = 600
}): React.ReactElement | null => {
  const [isResizing, setIsResizing] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isHidden, setIsHidden] = React.useState(false);
  const [width, setWidth] = React.useState(defaultWidth);
  const lastWidthRef = React.useRef(defaultWidth);
  
  // Check for mobile and very small screen size
  React.useEffect(() => {
    const checkScreenSize = () => {
      const isMobileSize = window.innerWidth <= 768;
      const isHiddenSize = window.innerWidth <= 480;
      setIsMobile(isMobileSize);
      setIsHidden(isHiddenSize);
      
      // Adjust width for mobile
      if (isMobileSize) {
        setWidth(window.innerWidth);
      } else if (isVisible) {
        setWidth(lastWidthRef.current);
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [isVisible]);

  // Handle width changes
  const handleWidthChange = React.useCallback((newWidth: number) => {
    const adjustedWidth = Math.max(newWidth, 300);
    setWidth(adjustedWidth);
    lastWidthRef.current = adjustedWidth;
    onResize?.(adjustedWidth);
  }, [onResize]);

  // Style for container visibility
  const containerStyle = React.useMemo(() => {
    if (windows.length === 0) {
      return {
        width: '0px',
        maxWidth: '0px',
        opacity: 0,
        visibility: 'hidden' as const,
        transition: 'width 300ms ease-in-out, opacity 200ms ease-in-out'
      };
    }
    
    if (!isVisible) {
      return {
        width: '36px',
        maxWidth: '36px',
        opacity: 1,
        visibility: 'visible' as const,
        transition: 'width 300ms ease-in-out, opacity 200ms ease-in-out'
      };
    }
    
    return {
      width: isMobile ? '100%' : `${width}px`,
      maxWidth: '100vw',
      opacity: 1,
      visibility: 'visible' as const,
      transition: 'width 300ms ease-in-out, opacity 200ms ease-in-out'
    };
  }, [isVisible, width, isMobile, windows.length]);

  // Handle panel visibility toggle
  const handleVisibilityToggle = React.useCallback(() => {
    if (!isVisible) {
      handleWidthChange(lastWidthRef.current);
    }
    onClose();
  }, [isVisible, handleWidthChange, onClose]);

  const handleTabClose = React.useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    
    // Find the next tab to focus before closing
    const currentIndex = windows.findIndex(w => w.id === tabId);
    let nextTabId: string | null = null;
    
    if (windows.length > 1) {
      // If there are other windows, find the next one to focus
      if (currentIndex === windows.length - 1) {
        // If it's the last tab, focus the previous one
        nextTabId = windows[currentIndex - 1].id;
      } else {
        // Otherwise focus the next one
        nextTabId = windows[currentIndex + 1].id;
      }
    }
    
    // Call onTabClose with the current tab
    onTabClose?.(tabId);
    
    // If we found a next tab, focus it
    if (nextTabId) {
      onTabChange(nextTabId);
    }

    // Check if this was the last window
    if (windows.length === 1 && windows[0].id === tabId) {
      onClose(); // Call the main close handler if the last tab is closed
    }
  }, [windows, onTabClose, onClose, onTabChange]);

  // Get first letter of window name for icon
  const getWindowIcon = React.useCallback((name: string) => {
    return (name || 'Untitled').charAt(0).toUpperCase();
  }, []);

  // Return null if there are no windows and we're not showing the collapsed view
  if (windows.length === 0 && !isVisible) {
    return null;
  }

  // Render collapsed view with icons
  const renderCollapsedView = () => (
    <div className="bg-white flex flex-col rounded-l-lg relative overflow-visible h-full shadow-lg">
      {/* Canvas button at the top */}
      <button
        onClick={handleVisibilityToggle}
        className="w-9 h-9 mx-auto flex items-center justify-center transition-colors bg-blue-100 text-gray-600 hover:bg-blue-200 rounded-lg mt-2"
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
              handleVisibilityToggle();
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
          onResize={handleWidthChange} 
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
                    ? 'bg-blue-50 text-blue-600'
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
            onClick={handleVisibilityToggle}
            className="md:hidden p-1.5 mr-2 hover:bg-gray-200 rounded-md text-gray-600"
            title="Back to notebook"
          >
            <FaChevronRight className="w-5 h-5" />
          </button>
          {/* Collapse button on larger screens */}
          <button
            onClick={handleVisibilityToggle}
            className="hidden md:flex items-center justify-center p-1.5 hover:bg-gray-200 rounded-md text-gray-600 transition-colors"
            title="Collapse panel"
          >
            <FaChevronRight className="w-5 h-5" />
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
                // Keep content mounted but hidden to preserve state
                display: activeTab === window.id ? 'block' : 'none',
                visibility: activeTab === window.id ? 'visible' : 'hidden'
              }}
            >
              {/* Conditional Rendering: Component or Iframe */}
              {window.component ? (
                <div className="w-full h-full overflow-auto p-4"> {/* Add padding and scroll for component */}
                  {window.component}
                </div>
              ) : window.src ? (
                <MemoizedIframe
                  src={window.src}
                  id={window.id}
                  name={window.name || 'Untitled'}
                />
              ) : (
                <div className="p-4 text-red-500">Error: Window must have either 'src' or 'component'.</div>
              )}
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
    <div 
      className={`flex flex-col border-l border-gray-200 bg-white relative ${isMobile ? 'fixed inset-0 z-50' : ''}`}
      style={containerStyle}
    >
      {isVisible ? renderExpandedView() : renderCollapsedView()}
    </div>
  );
};
