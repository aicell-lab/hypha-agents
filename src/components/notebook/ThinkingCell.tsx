import React, { useMemo } from 'react';
import { FaSpinner } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RoleSelector, CellRole } from './RoleSelector';

interface ThinkingCellProps {
  content: string;
  parent?: string; // ID of parent cell (user message that triggered this cell)
}

const ThinkingCell: React.FC<ThinkingCellProps> = ({ content, parent }) => {
  // Fixed role for thinking cells
  const role: CellRole = 'assistant';

  // Process content to replace markers and wrap with code block
  const processedContent = useMemo(() => {
    let processed = content
      .replace(/#Thoughts:/g, '# 🤔')
      .replace(/#FinalResponse:/g, '# ✨');
    
    // Only wrap with python code block if it's not already wrapped
    if (!processed.startsWith('```') && !processed.endsWith('```')) {
      processed = '```python\n' + processed + '\n```';
    }
    
    return processed;
  }, [content]);

  return (
    <div 
      className={`relative thinking-cell ${parent ? 'child-cell' : 'parent-cell'}`}
      data-parent={parent || undefined}
    >
      <div className="jupyter-cell-flex-container">
        {/* Add a placeholder for the execution count to match code cell alignment */}
     
        <div className="w-full overflow-hidden">

          <div className="ml-3 markdown-preview group relative overflow-x-auto w-[calc(100%-24px)] pt-2">
            <div className="markdown-body py-2 overflow-auto break-words min-h-[60px] flex items-center gap-4">
            <div className="pr-2">
            <RoleSelector role={role} onChange={() => {}} />
          </div>
              <div className="flex-shrink-0 transition-transform duration-700 ease-in-out hover:scale-110">
                <FaSpinner className="animate-spin h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-grow">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {processedContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingCell; 