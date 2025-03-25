import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThebeProvider, useThebe } from '../components/chat/ThebeProvider';
import { CodeCell } from '../components/chat/CodeCell';
import { ChatInput } from '../components/chat/ChatInput';
import { OutputItem } from '../components/chat/Chat';
import MarkdownCell from '../components/chat/MarkdownCell';
import { Dialog } from '@headlessui/react';
import Convert from 'ansi-to-html';
import '../styles/ansi.css';
import '../styles/jupyter.css';

const convert = new Convert({
  fg: '#000',
  bg: '#fff',
  newline: true,
  escapeXML: true,
  stream: false
});

// Define different types of cells in our notebook
type CellType = 'markdown' | 'code';
type ExecutionState = 'idle' | 'running' | 'success' | 'error';

interface NotebookCell {
  id: string;
  type: CellType;
  content: string;
  executionCount?: number;
  executionState: ExecutionState;
  output?: OutputItem[];
  metadata?: {
    collapsed?: boolean;
    scrolled?: boolean;
    trusted?: boolean;
    isNew?: boolean;
  };
}

interface NotebookMetadata {
  kernelspec: {
    name: string;
    display_name: string;
  };
  language_info: {
    name: string;
    version: string;
  };
  title?: string;
  created?: string;
  modified?: string;
}

interface NotebookData {
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

const KeyboardShortcutsDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const shortcuts = [
    { key: 'Ctrl/Cmd + Enter', description: 'Run the current cell' },
    { key: 'Shift + Enter', description: 'Run the current cell and select the cell below' },
    { key: 'Ctrl/Cmd + B', description: 'Insert a new code cell below' },
    { key: 'Ctrl/Cmd + Shift + Enter', description: 'Run all cells' },
    { key: 'Ctrl/Cmd + S', description: 'Save notebook' },
    { key: 'Esc', description: 'Enter command mode (when cell is focused)' },
    { key: 'Enter', description: 'Enter edit mode (when cell is focused)' },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg rounded bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-medium mb-4">Keyboard Shortcuts</Dialog.Title>
          
          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex justify-between gap-4 py-1">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{shortcut.key}</kbd>
                <span className="text-gray-600">{shortcut.description}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

const NotebookPage: React.FC = () => {
  const navigate = useNavigate();
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [executionCounter, setExecutionCounter] = useState(1);
  const endRef = useRef<HTMLDivElement>(null);
  const { isReady, executeCode } = useThebe();
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const cellRefs = useRef<{ [key: string]: React.RefObject<{ getCurrentCode: () => string }> }>({});
  const [notebookMetadata, setNotebookMetadata] = useState<NotebookMetadata>({
    kernelspec: {
      name: 'python',
      display_name: 'Python'
    },
    language_info: {
      name: 'python',
      version: '3.10'
    },
    title: 'Untitled Notebook',
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  });
  const [activeCellId, setActiveCellId] = useState<string | null>(null);

  // Create a stable addCell function with useCallback
  const addCell = useCallback((type: CellType, content: string = '') => {
    const newCell: NotebookCell = {
      id: generateId(),
      type,
      content: content || (type === 'code' ? '# Enter your code here' : 'Enter your markdown here'),
      executionState: 'idle',
      metadata: {
        collapsed: false,
        trusted: true,
        isNew: true
      }
    };
    
    // Create a ref for the new cell
    cellRefs.current[newCell.id] = React.createRef();
    
    setCells(prev => [...prev, newCell]);
  }, []);

  // Ensure we have at least one code cell to start with
  useEffect(() => {
    if (cells.length === 0) {
      addCell('code');
    }
  }, [cells.length, addCell]);

  // Scroll to bottom when cells change
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cells]);

  // Generate a unique ID for cells
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // Handle user input from the chat input component
  const handleSendMessage = (message: string) => {
    // If the message starts with / or #, it's a command
    if (message.startsWith('/') || message.startsWith('#')) {
      handleCommand(message);
      return;
    }

    // Otherwise, add as a rendered markdown cell
    const newCell: NotebookCell = {
      id: generateId(),
      type: 'markdown',
      content: message,
      executionState: 'idle',
      metadata: {
        collapsed: false,
        trusted: true,
        isNew: false // Mark as not a new cell, so it renders immediately
      }
    };
    
    // Create a ref for the new cell
    cellRefs.current[newCell.id] = React.createRef();
    
    setCells(prev => [...prev, newCell]);
  };

  // Handle special commands
  const handleCommand = (command: string) => {
    const normalizedCommand = command.toLowerCase().trim();
    
    if (normalizedCommand === '/code' || normalizedCommand === '#code') {
      addCell('code');
    } else if (normalizedCommand === '/markdown' || normalizedCommand === '#markdown') {
      const newCell: NotebookCell = {
        id: generateId(),
        type: 'markdown',
        content: 'Enter your markdown here',
        executionState: 'idle',
        metadata: {
          collapsed: false,
          trusted: true,
          isNew: true // Keep new markdown cells from commands in edit mode
        }
      };
      
      cellRefs.current[newCell.id] = React.createRef();
      setCells(prev => [...prev, newCell]);
    } else if (normalizedCommand === '/clear') {
      setCells([]);
      addCell('code'); // Always have at least one cell
    } else if (normalizedCommand.startsWith('/run')) {
      // This would be handled by the CodeCell component
      // But we could also implement a "run all" feature later
    } else {
      // If no command is recognized, just add as rendered markdown
      const newCell: NotebookCell = {
        id: generateId(),
        type: 'markdown',
        content: command,
        executionState: 'idle',
        metadata: {
          collapsed: false,
          trusted: true,
          isNew: false // Mark as not a new cell, so it renders immediately
        }
      };
      
      cellRefs.current[newCell.id] = React.createRef();
      setCells(prev => [...prev, newCell]);
    }
  };

  // Delete a cell by ID
  const deleteCell = (id: string) => {
    setCells(prev => prev.filter(cell => cell.id !== id));
  };

  // Update cell content
  const updateCellContent = (id: string, content: string) => {
    setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { ...cell, content } : cell
      )
    );
  };

  // Change cell type
  const changeCellType = (id: string, newType: CellType) => {
    setCells(prev => 
      prev.map(cell => 
        cell.id === id ? { ...cell, type: newType } : cell
      )
    );
  };

  // Update cell execution state
  const updateCellExecutionState = (id: string, state: ExecutionState, output?: OutputItem[]) => {
    setCells(prev => 
      prev.map(cell => {
        if (cell.id === id) {
          const updates: Partial<NotebookCell> = { executionState: state };
          if (state === 'success' && cell.type === 'code') {
            updates.executionCount = executionCounter;
            setExecutionCounter(prev => prev + 1);
          }
          if (output) {
            updates.output = output;
          }
          return { ...cell, ...updates };
        }
        return cell;
      })
    );
  };

  // Execute a cell
  const executeCell = async (id: string) => {
    const cell = cells.find(c => c.id === id);
    if (!cell || cell.type !== 'code' || !isReady) return;

    // Get the current code from the cell's ref
    const currentCode = cellRefs.current[id]?.current?.getCurrentCode() || cell.content;

    updateCellExecutionState(id, 'running');
    
    try {
      const outputs: OutputItem[] = [];
      await executeCode(currentCode, {
        onOutput: (output) => {
          outputs.push(output);
          updateCellExecutionState(id, 'running', outputs);
        },
        onStatus: (status) => {
          if (status === 'Completed') {
            updateCellExecutionState(id, 'success', outputs);
            // Update the cell content with the executed code
            updateCellContent(id, currentCode);
          } else if (status === 'Error') {
            updateCellExecutionState(id, 'error', outputs);
          }
        }
      });
    } catch (error) {
      updateCellExecutionState(id, 'error', [{
        type: 'stderr',
        content: error instanceof Error ? error.message : String(error)
      }]);
    }
  };

  // Render execution indicator
  const renderExecutionIndicator = (cell: NotebookCell) => {
    if (cell.type !== 'code') return null;
    
    const executionLabel = cell.executionState === 'running' ? '*' : 
                          cell.executionCount || ' ';
    
    return (
      <div className="flex-shrink-0 w-16 text-right pr-4 font-mono text-gray-500 select-none">
        {cell.executionState === 'running' ? (
          <span className="text-sm">[*]</span>
        ) : (
          <span className="text-sm">[{executionLabel}]</span>
        )}
      </div>
    );
  };

  // Handle cell focus
  const handleCellFocus = (id: string) => {
    setActiveCellId(id);
  };

  // Render cell toolbar
  const renderCellToolbar = (cell: NotebookCell) => {
    return (
      <div className="absolute right-0 top-0 flex items-center gap-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {cell.type === 'code' && (
          <>
            <button
              onClick={() => executeCell(cell.id)}
              disabled={!isReady || cell.executionState === 'running'}
              className="p-1 hover:bg-gray-100 rounded"
              title="Run cell"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => changeCellType(cell.id, 'markdown')}
              className="p-1 hover:bg-gray-100 rounded"
              title="Convert to Markdown"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>
          </>
        )}
        {cell.type === 'markdown' && (
          <button
            onClick={() => changeCellType(cell.id, 'code')}
            className="p-1 hover:bg-gray-100 rounded"
            title="Convert to Code"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>
        )}
        <button
          onClick={() => deleteCell(cell.id)}
          className="p-1 hover:bg-gray-100 rounded text-red-500"
          title="Delete cell"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    );
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if we're in an input field or editor
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl/Cmd + Enter to run current cell
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const activeCell = document.activeElement?.closest('[data-cell-id]');
        if (activeCell) {
          const cellId = activeCell.getAttribute('data-cell-id');
          if (cellId) {
            executeCell(cellId);
          }
        }
      }

      // Ctrl/Cmd + B to insert cell below
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        const activeCell = document.activeElement?.closest('[data-cell-id]');
        if (activeCell) {
          const cellId = activeCell.getAttribute('data-cell-id');
          if (cellId) {
            const index = cells.findIndex(c => c.id === cellId);
            if (index !== -1) {
              const newCells = [...cells];
              newCells.splice(index + 1, 0, {
                id: generateId(),
                type: 'code',
                content: '',
                executionState: 'idle',
                metadata: { collapsed: false, trusted: true }
              });
              setCells(newCells);
            }
          }
        }
      }

      // Ctrl/Cmd + Shift + Enter to run all cells
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        runAllCells();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cells]);

  // Run all cells
  const runAllCells = async () => {
    for (const cell of cells) {
      if (cell.type === 'code') {
        await executeCell(cell.id);
      }
    }
  };

  // Clear all outputs
  const clearAllOutputs = () => {
    setCells(prev => prev.map(cell => ({
      ...cell,
      output: undefined,
      executionState: 'idle'
    })));
  };

  // Restart kernel and clear outputs
  const restartKernel = async () => {
    clearAllOutputs();
    setExecutionCounter(1);
    // Add kernel restart logic here
  };

  // Save notebook
  const saveNotebook = () => {
    const notebookData: NotebookData = {
      metadata: {
        ...notebookMetadata,
        modified: new Date().toISOString()
      },
      cells
    };

    const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${notebookMetadata.title?.replace(/\s+/g, '_')}.ipynb` || 'untitled.ipynb';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load notebook
  const loadNotebook = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const notebookData: NotebookData = JSON.parse(content);
        
        setNotebookMetadata(notebookData.metadata);
        setCells(notebookData.cells.map(cell => ({
          ...cell,
          id: generateId(), // Generate new IDs for loaded cells
          executionState: 'idle',
          output: undefined, // Clear outputs on load
          metadata: {
            ...cell.metadata,
            isNew: false // Mark as not a new cell
          }
        })));
        
        setExecutionCounter(1); // Reset execution counter
      } catch (error) {
        console.error('Error loading notebook:', error);
        // TODO: Show error toast
      }
    };
    reader.readAsText(file);
  };

  // Handle keyboard shortcuts for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNotebook();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cells, notebookMetadata]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        {/* First row: Title and Help */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Back to Home"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              <input
                type="text"
                value={notebookMetadata.title}
                onChange={(e) => setNotebookMetadata(prev => ({ ...prev, title: e.target.value }))}
                className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                placeholder="Untitled Notebook"
              />
            </div>

            <button
              onClick={() => setIsShortcutsDialogOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Keyboard Shortcuts"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Second row: Action buttons */}
        <div className="px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="file"
                accept=".ipynb"
                onChange={loadNotebook}
                className="hidden"
                id="notebook-file"
              />
              <label
                htmlFor="notebook-file"
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition cursor-pointer"
              >
                Open
              </label>
              <button
                onClick={saveNotebook}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                title="Save notebook (Ctrl/Cmd + S)"
              >
                Save
              </button>
              <button
                onClick={runAllCells}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                title="Run all cells (Ctrl/Cmd + Shift + Enter)"
              >
                Run All
              </button>
              <button
                onClick={clearAllOutputs}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                title="Clear all outputs"
              >
                Clear
              </button>
              <button
                onClick={restartKernel}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                title="Restart kernel and clear outputs"
              >
                Restart
              </button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button 
                onClick={() => addCell('code')}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                title="Add code cell (Ctrl/Cmd + B)"
              >
                + Code Cell
              </button>
              <button 
                onClick={() => addCell('markdown')}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
              >
                + Markdown Cell
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notebook Content Area */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="max-w-5xl mx-auto px-4">
          {cells.map((cell, index) => (
            <div 
              key={cell.id}
              data-cell-id={cell.id}
              className={`group relative ${
                cell.executionState === 'error' ? 'border-red-200' : ''
              } mb-1 bg-white overflow-hidden`}
              onFocus={() => handleCellFocus(cell.id)}
              tabIndex={0}
            >
              {/* Cell Content */}
              <div className="flex relative">
                {renderExecutionIndicator(cell)}
                <div className="flex-1 min-w-0">
                  {cell.type === 'code' ? (
                    <div className="pl-0 py-2">
                      <CodeCell 
                        code={cell.content} 
                        language="python"
                        defaultCollapsed={false}
                        onExecute={() => executeCell(cell.id)}
                        isExecuting={cell.executionState === 'running'}
                        executionCount={cell.executionCount}
                        blockRef={cellRefs.current[cell.id]}
                        isActive={activeCellId === cell.id}
                      />
                    </div>
                  ) : (
                  
                      <MarkdownCell
                        content={cell.content}
                        onChange={(content) => updateCellContent(cell.id, content)}
                        initialEditMode={cell.metadata?.isNew === true}
                      />
              
                  )}
                  
                  {/* Output Area */}
                  {cell.type === 'code' && cell.output && cell.output.length > 0 && (
                    <div className="pl-4 pr-4 py-2 overflow-x-auto">
                      {cell.output.map((output, i) => (
                        <div key={i} className="output-item">
                          {output.type === 'stdout' && (
                            <pre 
                              className="text-gray-700 whitespace-pre-wrap text-sm py-1 font-mono break-words"
                              dangerouslySetInnerHTML={{ __html: convert.toHtml(output.content) }}
                            />
                          )}
                          {output.type === 'stderr' && (
                            <pre 
                              className="text-red-600 whitespace-pre-wrap text-sm py-1 font-mono break-words"
                              dangerouslySetInnerHTML={{ __html: convert.toHtml(output.content) }}
                            />
                          )}
                          {output.type === 'html' && (
                            <div className="py-1 overflow-auto" dangerouslySetInnerHTML={{ __html: output.content }} />
                          )}
                          {output.type === 'img' && (
                            <div className="py-2">
                              <img src={output.content} alt="Output" className="max-w-full" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cell Toolbar - Show on hover */}
                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded px-1">
                  {cell.type === 'code' && (
                    <>
                      <button
                        onClick={() => executeCell(cell.id)}
                        disabled={!isReady || cell.executionState === 'running'}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Run cell"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => changeCellType(cell.id, 'markdown')}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Convert to Markdown"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                      </button>
                    </>
                  )}
                  {cell.type === 'markdown' && (
                    <button
                      onClick={() => changeCellType(cell.id, 'code')}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Convert to Code"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => deleteCell(cell.id)}
                    className="p-1 hover:bg-gray-100 rounded text-red-500"
                    title="Delete cell"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-2 text-xs text-center">
            <p className="text-gray-500">
              Type a message to add a markdown cell, or use commands like /code or /markdown to add specific cell types
            </p>
          </div>
          <ChatInput 
            onSend={handleSendMessage} 
            disabled={!isReady}
            isThebeReady={isReady}
            placeholder={isReady ? "Enter text or command (e.g., /code, /markdown, /clear)" : "Initializing code execution environment..."}
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={isShortcutsDialogOpen}
        onClose={() => setIsShortcutsDialogOpen(false)}
      />
    </div>
  );
};

// Wrap the component with ThebeProvider to enable code execution
const NotebookPageWithThebe: React.FC = () => (
  <ThebeProvider>
    <NotebookPage />
  </ThebeProvider>
);

export default NotebookPageWithThebe; 