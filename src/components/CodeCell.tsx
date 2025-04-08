import React, { useRef } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { VscCode } from 'react-icons/vsc';
import { RiRobot2Line } from 'react-icons/ri';
import { RoleSelector } from './notebook/RoleSelector';

// Define the missing types
type CellRole = 'user' | 'system' | 'assistant';

interface OutputItem {
  type: string;
  data: any;
}

interface CodeCellProps {
  code: string;
  language?: string;
  onExecute?: () => void;
  isExecuting?: boolean;
  executionCount?: number;
  blockRef?: React.RefObject<{
    getCurrentCode: () => string;
    focus: () => void;
    getContainerDomNode: () => HTMLElement | null;
  }>;
  isActive?: boolean;
  role?: CellRole;
  onRoleChange?: (role: CellRole) => void;
  onChange?: (value: string) => void;
  hideCode?: boolean;
  onVisibilityChange?: (isVisible: boolean) => void;
  hideOutput?: boolean;
  onOutputVisibilityChange?: (isVisible: boolean) => void;
  parent?: string;
  output?: OutputItem[];
  staged?: boolean; // Whether this is a staged (uncommitted) cell
}

export const CodeCell: React.FC<CodeCellProps> = ({ 
  code, 
  language = 'python',
  onExecute,
  isExecuting = false,
  executionCount,
  blockRef,
  isActive = false,
  role,
  onRoleChange,
  onChange,
  hideCode = false,
  onVisibilityChange,
  hideOutput = false,
  onOutputVisibilityChange,
  parent,
  output,
  staged = false
}) => {
  // Add missing refs and handlers
  const editorDivRef = useRef<HTMLDivElement>(null);
  
  const handleEditorClick = () => {
    // Implementation will depend on your requirements
  };

  // Add a check for staged cells
  const isStagedCell = staged && parent;
  const isFullyCollapsed = (role === 'system' && hideCode) || (isStagedCell && hideCode);

  // ... rest of component ...

  return (
    <div 
      ref={editorDivRef}
      className={`relative w-full code-cell ${isActive ? 'notebook-cell-active' : ''} ${parent ? 'child-cell' : 'parent-cell'} ${role === 'system' ? 'bg-gray-50' : ''} ${staged ? 'staged-cell bg-gray-50/50 border-l-2 border-gray-200' : ''}`}
      onClick={handleEditorClick}
      data-parent={parent || undefined}
      data-staged={staged || undefined}
    >
      {isFullyCollapsed ? (
        // Minimal icon view for collapsed system or staged cells
        <div 
          className={`flex items-center justify-center cursor-pointer rounded transition-colors mx-2 my-0.5 ${
            isExecuting 
              ? 'py-2 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 shadow-sm' 
              : isStagedCell
                ? 'py-0.5 hover:bg-slate-100 border-l border-slate-200'
                : 'py-0.5 hover:bg-gray-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityChange?.(!hideCode);
            onOutputVisibilityChange?.(!hideOutput);
          }}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onVisibilityChange?.(!hideCode);
              onOutputVisibilityChange?.(!hideOutput);
            }
          }}
          title={isExecuting ? "Executing system configuration" : isStagedCell ? "Staged code (click to expand)" : "System Configuration"}
        >
          <div className={`flex items-center gap-2 transition-opacity ${
            isExecuting ? 'opacity-100' : 'opacity-60 hover:opacity-100'
          }`}>
            {isExecuting ? (
              <FaSpinner className="w-4 h-4 text-yellow-600 animate-spin" />
            ) : isStagedCell ? (
              <VscCode className="w-3 h-3 text-slate-500" />
            ) : (
              <RiRobot2Line className="w-3 h-3 text-gray-500" />
            )}
            <span className={`${
              isExecuting ? 'text-sm font-medium text-yellow-700' : 
              isStagedCell ? 'text-xs text-slate-500' : 'text-xs text-gray-500'
            }`}>
              {isExecuting ? "Executing startup script..." : 
               isStagedCell ? "Staged code" : "System Configuration"}
            </span>
          </div>
        </div>
      ) : (
        // Normal cell view with staged indicator if needed
        <div className="jupyter-cell-flex-container items-start w-full max-w-full">
          {/* Execution count with role icon */}
          <div className="execution-count flex-shrink-0 flex flex-col items-end gap-0.5">
            {!isExecuting && role !== undefined && onRoleChange && (
              <div className="pr-1">
                <RoleSelector role={role} onChange={onRoleChange} />
              </div>
            )}
            {isExecuting ? (
              <div className="text-gray-500 pr-2">
                <FaSpinner className="w-4 h-4 animate-spin text-yellow-500" />
              </div>
            ) : (
              <div className="text-gray-500">
                {executionCount ? `[${executionCount}]:` : '[*]:'}
              </div>
            )}
          </div>
          
          {/* Editor with staged indicator */}
          <div className={`editor-container mt-2 w-full overflow-hidden ${isActive ? 'editor-container-active' : ''} ${staged ? 'border-l-2 border-slate-200 pl-2' : ''}`}>
            {/* Staged indicator for expanded cells */}
            {staged && !hideCode && (
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                <span>Staged code (uncommitted)</span>
              </div>
            )}
            
            {/* Rest of the editor component */}
            {/* Code editor would go here */}
          </div>
        </div>
      )}
    </div>
  );
}; 