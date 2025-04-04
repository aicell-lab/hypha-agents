import React, { useCallback, useEffect, useState } from 'react';

interface SplitterProps {
  onResize: (newWidth: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  minWidth?: number;
  maxWidth?: number;
}

export const Splitter: React.FC<SplitterProps> = ({ 
  onResize, 
  onResizeStart,
  onResizeEnd,
  minWidth = 300, 
  maxWidth = window.innerWidth - 300 
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(e.currentTarget.parentElement?.offsetWidth || 0);
    onResizeStart?.();
    e.preventDefault();
  }, [onResizeStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = startX - e.clientX;
    const newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
    onResize(newWidth);
    e.preventDefault();
  }, [isResizing, startX, startWidth, minWidth, maxWidth, onResize]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      onResizeEnd?.();
    }
  }, [isResizing, onResizeEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 hover:opacity-50 group"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-0 left-[-2px] w-[4px] group-hover:bg-blue-500/20" />
    </div>
  );
}; 