import React, { useRef, useEffect, useCallback } from 'react';
import { CellType, CellRole, NotebookCell } from '../../types/notebook';
import { CodeCell } from './CodeCell';
import MarkdownCell from './MarkdownCell';
import ThinkingCell from './ThinkingCell';
import { FaSpinner, FaSyncAlt, FaTrash, FaCopy, FaCheckCircle, FaUndo, FaRegLightbulb } from 'react-icons/fa';
import { VscCode } from 'react-icons/vsc';
import { MdOutlineTextFields } from 'react-icons/md';
import { copyToClipboard } from '../../utils/notebookUtils';
import { CanvasPanel } from './CanvasPanel';

interface NotebookContentProps {
  cells: NotebookCell[];
  activeCellId: string;
  onActiveCellChange: (id: string) => void;
  onExecuteCell: (id: string) => Promise<string>;
  onUpdateCellContent: (id: string, content: string) => void;
  onToggleCellEditing: (id: string, isEditing: boolean) => void;
  onToggleCodeVisibility: (id: string) => void;
  onToggleOutputVisibility: (id: string) => void;
  onChangeCellType: (id: string, type: CellType) => void;
  onUpdateCellRole: (id: string, role: CellRole) => void;
  onDeleteCell: (id: string) => void;
  onDeleteCellWithChildren: (id: string) => void;
  onToggleCellCommitStatus: (id: string) => void;
  onRegenerateClick: (id: string) => void;
  onStopChatCompletion: () => void;
  getEditorRef: (id: string) => React.RefObject<any>;
  isReady: boolean;
  activeAbortController: AbortController | null;
  showCanvasPanel: boolean;
  onAbortExecution: () => void;
}

const NotebookContent: React.FC<NotebookContentProps> = ({
  cells,
  activeCellId,
  onActiveCellChange,
  onExecuteCell,
  onUpdateCellContent,
  onToggleCellEditing,
  onToggleCodeVisibility,
  onToggleOutputVisibility,
  onChangeCellType,
  onUpdateCellRole,
  onDeleteCell,
  onDeleteCellWithChildren,
  onToggleCellCommitStatus,
  onRegenerateClick,
  onStopChatCompletion,
  getEditorRef,
  isReady,
  activeAbortController,
  showCanvasPanel,
  onAbortExecution
}) => {
  const endRef = useRef<HTMLDivElement>(null);
  const editorRefs = useRef<Record<string, any>>({});

  const getEditorRefCallback = useCallback((cellId: string) => {
    if (!editorRefs.current[cellId]) {
      editorRefs.current[cellId] = React.createRef();
    }
    return editorRefs.current[cellId];
  }, []);

  // Helper function to scroll to bottom
  const scrollToBottom = () => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll to bottom of content area when new cells are added
  useEffect(() => {
    // Only auto-scroll if the new cell is added at the end
    if (cells.length > 0 && activeCellId === cells[cells.length - 1].id) {
      scrollToBottom();
    }
  }, [cells.length, activeCellId]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main cell area - hidden on small screens when canvas is open */}
      <div className={`flex-1 overflow-y-auto ${showCanvasPanel ? 'hidden md:block' : ''}`}>
        <div className="max-w-4xl mx-auto mt-2 p-0 sm:p-2">
          {cells.length > 0 ? (
            cells.map((cell) => (
              <div
                key={cell.id}
                data-cell-id={cell.id}
                className={`notebook-cell-container group relative ${
                  cell.executionState === 'error' ? 'border-red-200' : ''
                } ${cell.metadata?.parent ? 'child-cell' : ''} mb-1 bg-white overflow-hidden rounded-md`}
                onClick={() => onActiveCellChange(cell.id)}
                tabIndex={0}
              >
                {/* Cell Content */}
                <div className="flex relative w-full">
                  <div className="flex-1 min-w-0 w-full overflow-x-hidden">
                    {cell.type === 'thinking' ? (
                      <ThinkingCell
                        content={cell.content}
                        parent={cell.metadata?.parent}
                        onStop={activeAbortController ? onStopChatCompletion : undefined}
                      />
                    ) : cell.type === 'code' ? (
                      <CodeCell
                        code={cell.content}
                        language={cell.language || 'python'}
                        onExecute={() => onExecuteCell(cell.id)}
                        onAbort={onAbortExecution}
                        isExecuting={cell.executionState === 'running'}
                        executionCount={cell.executionState === 'running' ? undefined : cell.executionCount}
                        blockRef={getEditorRefCallback(cell.id)}
                        isActive={activeCellId === cell.id}
                        role={cell.role}
                        onRoleChange={(role) => onUpdateCellRole(cell.id, role)}
                        onChange={(newCode) => onUpdateCellContent(cell.id, newCode)}
                        hideCode={cell.metadata?.isCodeVisible === false}
                        onVisibilityChange={(isVisible) => onToggleCodeVisibility(cell.id)}
                        hideOutput={cell.metadata?.isOutputVisible === false}
                        onOutputVisibilityChange={(isVisible) => onToggleOutputVisibility(cell.id)}
                        parent={cell.metadata?.parent}
                        output={cell.output}
                        staged={cell.metadata?.staged === true}
                      />
                    ) : (
                      <MarkdownCell
                        content={cell.content}
                        onChange={(content) => onUpdateCellContent(cell.id, content)}
                        initialEditMode={cell.metadata?.isNew === true}
                        role={cell.role}
                        onRoleChange={(role) => onUpdateCellRole(cell.id, role)}
                        isEditing={cell.metadata?.isEditing || false}
                        onEditingChange={(isEditing) => onToggleCellEditing(cell.id, isEditing)}
                        editorRef={getEditorRefCallback(cell.id)}
                        isActive={activeCellId === cell.id}
                        parent={cell.metadata?.parent}
                        onRegenerateResponse={cell.role === 'user' ? () => onRegenerateClick(cell.id) : undefined}
                        staged={cell.metadata?.staged === true}
                        hideContent={cell.metadata?.isCodeVisible === false}
                        onVisibilityChange={() => onToggleCodeVisibility(cell.id)}
                      />
                    )}
                  </div>

                  {/* Cell Toolbar - Show on hover */}
                  <div
                    className="absolute right-4 top-[-16px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded px-1 z-10 hover:opacity-100 border border-gray-200"
                    style={{ pointerEvents: 'auto' }}
                  >
                    {/* Cell Type Indicator */}
                    <span className="text-xs text-gray-500 px-1 border-r border-gray-200 mr-1">
                      {cell.type === 'code' ? (
                        <span className="flex items-center gap-1">
                          <VscCode className="w-3 h-3" />
                          <span className="hidden md:inline">Code</span>
                          {cell.metadata?.staged && (
                            <span className="ml-1 px-1 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                              Staged
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <MdOutlineTextFields className="w-3 h-3" />
                          <span className="hidden md:inline">Markdown</span>
                          {cell.metadata?.staged && (
                            <span className="ml-1 px-1 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                              Staged
                            </span>
                          )}
                        </span>
                      )}
                    </span>

                    {/* --- Conditional Commit/Uncommit Buttons --- */}
                    {cell.role === 'assistant' && typeof cell.metadata?.staged === 'boolean' && cell.metadata?.parent && cell.metadata?.isCodeVisible !== false && (
                      <>
                        {cell.metadata.staged ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleCellCommitStatus(cell.id);
                            }}
                            className="p-1 hover:bg-green-100 rounded text-green-600 flex items-center gap-1"
                            title="Commit this staged cell"
                          >
                            <FaCheckCircle className="w-3.5 h-3.5" />
                            <span className="hidden md:inline text-xs">Commit</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleCellCommitStatus(cell.id);
                            }}
                            className="p-1 hover:bg-yellow-100 rounded text-yellow-600 flex items-center gap-1"
                            title="Uncommit this cell (mark as staged)"
                          >
                            <FaUndo className="w-3.5 h-3.5" />
                            <span className="hidden md:inline text-xs">Uncommit</span>
                          </button>
                        )}
                        <div className="h-4 w-px bg-gray-200 mx-1"></div> {/* Separator */}
                      </>
                    )}
                    {/* --- End Commit/Uncommit Buttons --- */}

                    {cell.type === 'code' && (
                      <>
                        {/* Add Copy Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(cell.content);
                          }}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                          title="Copy code"
                        >
                          <FaCopy className="w-3.5 h-3.5" />
                          <span className="hidden md:inline text-xs">Copy</span>
                        </button>

                        {/* Hide/Show Code Button - Moved before Run button */}
                        <button
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            onToggleCodeVisibility(cell.id);
                          }}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                          title={cell.metadata?.isCodeVisible === false ? "Show code" : "Hide code"}
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${cell.metadata?.isCodeVisible === false ? 'transform rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={cell.metadata?.isCodeVisible === false
                                ? "M9 5l7 7-7 7"
                                : "M19 9l-7 7-7-7"
                              }
                            />
                          </svg>
                          <span className="hidden md:inline text-xs">
                            {cell.metadata?.isCodeVisible === false ? 'Show' : 'Hide'}
                          </span>
                        </button>

                        <button
                          onClick={() => onExecuteCell(cell.id)}
                          disabled={!isReady || cell.executionState === 'running'}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Run cell"
                        >
                          {cell.executionState === 'running' ? (
                            <FaSpinner className="w-4 h-4 animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          <span className="hidden md:inline text-xs">Run</span>
                        </button>

                        <button
                          onClick={() => onChangeCellType(cell.id, 'markdown')}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                          title="Convert to Markdown"
                          disabled={cell.executionState === 'running'}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          <span className="hidden md:inline text-xs">Convert</span>
                        </button>
                      </>
                    )}

                    {cell.type === 'markdown' && (
                      <>
                        {cell.metadata?.isEditing ? (
                          <button
                            onClick={() => onToggleCellEditing(cell.id, false)}
                            className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                            title="Render markdown (Shift+Enter)"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden md:inline text-xs">Render</span>
                          </button>
                        ) : (
                          <>
                            {/* Add Copy Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(cell.content);
                              }}
                              className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                              title="Copy markdown"
                            >
                              <FaCopy className="w-3.5 h-3.5" />
                              <span className="hidden md:inline text-xs">Copy</span>
                            </button>
                            <button
                              onClick={() => onToggleCellEditing(cell.id, true)}
                              className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                              title="Edit markdown"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                              <span className="hidden md:inline text-xs">Edit</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => onChangeCellType(cell.id, 'code')}
                          className="p-1 hover:bg-gray-100 rounded flex items-center gap-1"
                          title="Convert to Code"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <span className="hidden md:inline text-xs">Convert</span>
                        </button>
                      </>
                    )}

                    {/* Add regenerate button for user markdown cells */}
                    {cell.role === 'user' && cell.type === 'markdown' && (
                      <button
                        onClick={() => onRegenerateClick(cell.id)}
                        disabled={!isReady || activeAbortController !== null}
                        className="p-1 hover:bg-green-100 rounded text-green-600 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Regenerate AI response"
                      >
                        <FaSyncAlt className="w-3 h-3" />
                        <span className="hidden md:inline text-xs">Regenerate</span>
                      </button>
                    )}

                    {/* Delete buttons - different for user vs. assistant cells */}
                    {cell.role === 'user' ? (
                      <div className="relative flex items-center gap-1">
                        {/* Delete button group with expanding options */}
                        <div className="flex items-center gap-1 bg-white rounded overflow-hidden transition-all duration-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const target = e.currentTarget.parentElement;
                              if (target) {
                                target.classList.toggle('expanded');
                              }
                            }}
                            className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1"
                            title="Delete options"
                          >
                            <FaTrash className="w-4 h-4" />
                            <span className="hidden md:inline text-xs">Delete</span>
                          </button>

                          {/* Additional delete options - initially hidden */}
                          <div className="hidden expanded:flex items-center gap-1 ml-1 pl-1 border-l border-gray-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCell(cell.id);
                              }}
                              className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1 whitespace-nowrap"
                            >
                              <span className="hidden md:inline text-xs">This Cell</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCellWithChildren(cell.id);
                              }}
                              className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1 whitespace-nowrap"
                            >
                              <span className="hidden md:inline text-xs">With Responses</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCell(cell.id);
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-500 flex items-center gap-1"
                        title="Delete cell"
                      >
                        <FaTrash className="w-4 h-4" />
                        <span className="hidden md:inline text-xs">Delete</span>
                      </button>
                    )}
                  </div>
                </div>
                {/* Active cell indicator strip */}
                {activeCellId === cell.id && (
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${cell.metadata?.parent ? 'ml-2 bg-blue-300' : 'bg-blue-500'}`}></div>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500 py-12">
              <div className="bg-white rounded-lg p-8 shadow-sm max-w-2xl w-full text-center">
                <FaRegLightbulb className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                <h2 className="text-2xl font-semibold text-gray-700 mb-3">Welcome to Hypha Agent Lab</h2>
                <p className="text-gray-600 mb-6">
                  This is your workspace for creating AI Agents. Start by typing a message or adding a cell.
                </p>
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <VscCode className="w-6 h-6 mx-auto mb-2 text-indigo-500" />
                    <h3 className="font-medium text-gray-700 mb-1">Code Cells</h3>
                    <p className="text-sm text-gray-500">Write and execute code with real-time output</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <MdOutlineTextFields className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <h3 className="font-medium text-gray-700 mb-1">Markdown Cells</h3>
                    <p className="text-sm text-gray-500">Document your work with formatted text</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
};

export default NotebookContent; 