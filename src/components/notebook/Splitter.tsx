import React, { useCallback, useEffect, useState, useRef } from 'react';

interface SplitterProps {
  onResize: (newWidth: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  minWidth?: number;
  maxWidth?: number;
  position?: 'left' | 'right';
}

export const Splitter: React.FC<SplitterProps> = ({ 
  onResize, 
  onResizeStart,
  onResizeEnd,
  minWidth = 300, 
  maxWidth = window.innerWidth - 300,
  position = 'left'
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const animationFrameRef = useRef<number>();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setStartX(e.clientX);
    
    // Get the canvas panel container width more reliably
    const canvasPanel = e.currentTarget.closest('[data-canvas-panel]') as HTMLElement;
    const currentWidth = canvasPanel?.offsetWidth || e.currentTarget.parentElement?.offsetWidth || 600;
    setStartWidth(currentWidth);
    
    onResizeStart?.();
    e.preventDefault();
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [onResizeStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use requestAnimationFrame to throttle updates more aggressively
    animationFrameRef.current = requestAnimationFrame(() => {
      // Calculate delta based on position
      const deltaX = position === 'left' 
        ? startX - e.clientX  // For left side (canvas panel), moving left increases width
        : e.clientX - startX; // For right side (sidebar), moving right increases width
      
      const newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
      onResize(newWidth);
    });

    // Prevent default to avoid text selection and other browser behaviors
    e.preventDefault();
    e.stopPropagation();
  }, [isResizing, startX, startWidth, minWidth, maxWidth, onResize, position]);

  const handleMouseUp = useCallback((e?: Event) => {
    if (isResizing) {
      setIsResizing(false);
      onResizeEnd?.();
      
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Restore default cursor and text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      // Remove event listeners immediately
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleMouseUp);
      if (e) e.preventDefault();
    }
  }, [isResizing, onResizeEnd, handleMouseMove]);

  // Add event listeners when resizing starts
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove, { passive: false });
      window.addEventListener('mouseup', handleMouseUp, { passive: false });
      window.addEventListener('blur', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('blur', handleMouseUp);
        
        // Cleanup animation frame on unmount
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`absolute ${position === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 hover:opacity-50 group z-10`}
      onMouseDown={handleMouseDown}
    >
      <div className={`absolute inset-y-0 ${position === 'left' ? 'left-[-2px]' : 'right-[-2px]'} w-[4px] group-hover:bg-blue-500/20`} />
    </div>
  );
}; 