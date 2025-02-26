import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThebeProvider, useThebe } from '../components/chat/ThebeProvider';
import { InteractiveCodeBlock } from '../components/chat/InteractiveCodeBlock';
import { ChatInput } from '../components/chat/ChatInput';
import { OutputItem } from '../components/chat/Chat';
import MarkdownCell from '../components/chat/MarkdownCell';

// Define different types of cells in our notebook
type CellType = 'markdown' | 'code';

interface NotebookCell {
  id: string;
  type: CellType;
  content: string;
  output?: OutputItem[];
}

const NotebookPage: React.FC = () => {
  const navigate = useNavigate();
  const [cells, setCells] = useState<NotebookCell[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const { isReady } = useThebe();

  // Create a stable addCell function with useCallback
  const addCell = useCallback((type: CellType, content: string = '') => {
    const newCell: NotebookCell = {
      id: generateId(),
      type,
      content: content || (type === 'code' ? '# Enter your code here' : 'Enter your markdown here'),
    };
    
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

    // Otherwise, add as a markdown cell
    addCell('markdown', message);
  };

  // Handle special commands
  const handleCommand = (command: string) => {
    const normalizedCommand = command.toLowerCase().trim();
    
    if (normalizedCommand === '/code' || normalizedCommand === '#code') {
      addCell('code');
    } else if (normalizedCommand === '/markdown' || normalizedCommand === '#markdown') {
      addCell('markdown');
    } else if (normalizedCommand === '/clear') {
      setCells([]);
      addCell('code'); // Always have at least one cell
    } else if (normalizedCommand.startsWith('/run')) {
      // This would be handled by the InteractiveCodeBlock component
      // But we could also implement a "run all" feature later
    } else {
      // If no command is recognized, just add as markdown
      addCell('markdown', command);
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

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
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
            <h1 className="text-xl font-semibold">Interactive Notebook</h1>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => addCell('code')}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
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

      {/* Notebook Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">
          {cells.map((cell, index) => (
            <div key={cell.id} className="mb-6 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* Cell Controls */}
              <div className="flex items-center justify-between bg-gray-50 px-3 py-1 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Cell {index + 1}</span>
                  <select 
                    value={cell.type}
                    onChange={(e) => changeCellType(cell.id, e.target.value as CellType)}
                    className="text-sm border-gray-300 rounded"
                    aria-label="Cell type"
                  >
                    <option value="code">Code</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteCell(cell.id)}
                    className="p-1 text-gray-500 hover:text-red-500 rounded"
                    title="Delete cell"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  {index > 0 && (
                    <button
                      onClick={() => {
                        setCells(prev => {
                          const newCells = [...prev];
                          [newCells[index], newCells[index - 1]] = [newCells[index - 1], newCells[index]];
                          return newCells;
                        });
                      }}
                      className="p-1 text-gray-500 hover:text-blue-500 rounded"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                  )}
                  {index < cells.length - 1 && (
                    <button
                      onClick={() => {
                        setCells(prev => {
                          const newCells = [...prev];
                          [newCells[index], newCells[index + 1]] = [newCells[index + 1], newCells[index]];
                          return newCells;
                        });
                      }}
                      className="p-1 text-gray-500 hover:text-blue-500 rounded"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Cell Content */}
              <div className="p-4">
                {cell.type === 'code' ? (
                  <InteractiveCodeBlock 
                    code={cell.content} 
                    language="python"
                    defaultCollapsed={false}
                  />
                ) : (
                  <MarkdownCell
                    content={cell.content}
                    onChange={(content) => updateCellContent(cell.id, content)}
                  />
                )}
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