import React, { useState, useRef, useEffect } from 'react';
import { BsQuestionCircle } from 'react-icons/bs';

interface TooltipProps {
  content: string | React.ReactNode;
  children?: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  icon?: React.ReactNode;
  width?: string;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  icon = <BsQuestionCircle size={16} />,
  width = '220px',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  
  // Handle clicking outside to close the tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current && 
        triggerRef.current && 
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Position class mapping
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
  };
  
  // Arrow position classes
  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent',
  };
  
  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger element */}
      <div 
        ref={triggerRef}
        className="inline-flex items-center cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
      >
        {children || (
          <span className="text-gray-500 hover:text-gray-700 transition-colors">
            {icon}
          </span>
        )}
      </div>
      
      {/* Tooltip content */}
      {isVisible && (
        <div 
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]}`}
          style={{ width }}
          role="tooltip"
        >
          {/* Tooltip content */}
          <div className="bg-gray-800 text-white text-sm rounded-lg py-2 px-3 shadow-lg">
            {typeof content === 'string' ? (
              <p className="text-sm">{content}</p>
            ) : (
              content
            )}
          </div>
          
          {/* Arrow */}
          <div 
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip; 