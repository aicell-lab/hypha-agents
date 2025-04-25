import React, { useMemo } from 'react';
import { FaSpinner, FaStop } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import { RoleSelector, CellRole } from './RoleSelector';
import type { CodeComponent } from 'react-markdown/lib/ast-to-react';

// Register languages
SyntaxHighlighter.registerLanguage('python', python);

interface ThinkingCellProps {
  content: string;
  parent?: string; // ID of parent cell (user message that triggered this cell)
  onStop?: () => void; // New callback for stopping the completion
}

// Helper function to extract thoughts from script
function extractThoughts(script: string): string | null {
  const match = script.match(/<thoughts>([\s\S]*?)<\/thoughts>/);
  return match ? match[1].trim() : null;
}

// Helper function to extract script content and ID
interface ScriptContent {
  content: string;
  id?: string;
}

function extractScript(script: string): ScriptContent | null {
  // Match <py-script> with optional attributes, followed by content, then closing tag
  const match = script.match(/<py-script(?:\s+([^>]*))?>([\s\S]*?)<\/py-script>/);
  if (!match) return null;

  const [, attrs, content] = match;
  let id: string | undefined;
  
  if (attrs) {
    const idMatch = attrs.match(/id=["']([^"']*)["']/);
    if (idMatch) {
      id = idMatch[1];
    }
  }

  return {
    content: content.trim(),
    id
  };
}

// Helper function to extract final response
interface ReturnToUserResult {
  content: string;
  properties: Record<string, string>;
}

function extractReturnToUser(script: string): ReturnToUserResult | null {
  const match = script.match(/<returnToUser(?:\s+([^>]*))?>([\s\S]*?)<\/returnToUser>/);
  if (!match) return null;

  const properties: Record<string, string> = {};
  const [, attrs, content] = match;
  
  if (attrs) {
    const propRegex = /(\w+)=["']([^"']*)["']/g;
    let propMatch;
    while ((propMatch = propRegex.exec(attrs)) !== null) {
      const [, key, value] = propMatch;
      properties[key] = value;
    }
  }

  return {
    content: content.trim(),
    properties
  };
}

// Helper function to handle incomplete tags
function completeIncompleteTag(content: string): string {
  // Handle incomplete <thoughts> tag
  if (content.includes('<thoughts>') && !content.includes('</thoughts>')) {
    content += '</thoughts>';
  }
  
  // Handle incomplete <py-script> tag
  if (content.includes('<py-script') && !content.includes('</py-script>')) {
    // Check if we need to close the opening tag first
    if (!content.includes('>')) {
      content += '>';
    }
    content += '</py-script>';
  }
  
  // Handle incomplete <returnToUser> tag
  if (content.includes('<returnToUser') && !content.includes('</returnToUser>')) {
    // Check if we need to close the opening tag first
    if (!content.includes('>')) {
      content += '>';
    }
    content += '</returnToUser>';
  }
  
  return content;
}

const ThinkingCell: React.FC<ThinkingCellProps> = ({ content, parent, onStop }) => {
  // Fixed role for thinking cells
  const role: CellRole = 'assistant';

  // Process content to extract and format different parts
  const processedContent = useMemo(() => {
    // Complete any incomplete tags for display purposes
    const completedContent = completeIncompleteTag(content);
    
    let processed = '';
    
    // Extract thoughts
    const thoughts = extractThoughts(completedContent);
    if (thoughts) {
      processed += `🤔 ${thoughts}\n`;
    }
    
    // Extract script if present
    const script = extractScript(completedContent);
    if (script) {
      processed += '```python\n' + (script.content || '') + '\n```\n\n';
    }
    
    // Extract final response if present
    const returnToUser = extractReturnToUser(completedContent);
    if (returnToUser) {
      processed += `✨ ${returnToUser.content}\n`;
    }
    
    // If no tags were found, wrap the entire content in a code block
    if (!thoughts && !script && !returnToUser) {
      processed = '```\n' + completedContent + '\n```';
    }
    return processed || '🤔 Thinking...';
  }, [content]);

  return (
    <div 
      className={`relative thinking-cell ${parent ? 'child-cell' : 'parent-cell'}`}
      data-parent={parent || undefined}
    >
      <div className="jupyter-cell-flex-container">
        <div className="w-full overflow-hidden">
          {/* Status bar with Thinking indicator and Stop button */}
          <div className="py-2 flex justify-center items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-50">
              <FaSpinner className="animate-spin h-4 w-4 text-blue-500" />
              <span className="text-xs text-blue-600 font-medium">Thinking...</span>
            </div>
            {onStop && (
              <button
                onClick={onStop}
                className="px-3 py-1 rounded text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-sm transition-colors flex items-center gap-1"
                title="Stop generation"
              >
                <FaStop className="h-3 w-3" />
                <span>Stop</span>
              </button>
            )}
          </div>

          <div className="ml-3 markdown-preview group relative overflow-x-auto w-[calc(100%-24px)]">
            <div className="markdown-body py-2 overflow-auto break-words min-h-[60px] flex items-center gap-4">
              <div className="pr-2">
                <RoleSelector role={role} onChange={() => {}} />
              </div>
              <div className="flex-grow">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: React.memo(({ inline, className, children }: { inline: boolean, className: string, children: React.ReactNode }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const language = match ? match[1] : 'text';
                      
                      if (inline) {
                        return (
                          <code className={`bg-gray-100 rounded px-1 py-0.5 font-mono text-sm ${className || ''}`}>
                            {children}
                          </code>
                        );
                      }

                      return (
                        <SyntaxHighlighter
                          language={language}
                          style={oneLight}
                          customStyle={{ 
                            margin: '0',
                            padding: '1rem'
                          }}
                          showLineNumbers={true}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      );
                    }) as CodeComponent
                  }}
                >
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