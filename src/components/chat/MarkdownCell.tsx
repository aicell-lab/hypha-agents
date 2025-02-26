import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownCellProps {
  content: string;
  onChange: (content: string) => void;
}

const MarkdownCell: React.FC<MarkdownCellProps> = ({ content, onChange }) => {
  const [isEditing, setIsEditing] = useState(true);

  return (
    <div>
      {isEditing ? (
        <div className="markdown-editor">
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-[100px] p-2 border border-gray-300 rounded-md font-mono"
            placeholder="Enter markdown text"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Preview
            </button>
          </div>
        </div>
      ) : (
        <div className="markdown-preview">
          <div className="markdown-body border rounded-md p-4 bg-white">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <SyntaxHighlighter
                      style={oneLight}
                      language={match[1]}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-2 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownCell; 