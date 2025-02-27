import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useThebe } from './ThebeProvider';
import { CodeBlockSelector } from './CodeBlockSelector';
import type { Components } from 'react-markdown';
import type { Message, ContentItem, OutputItem } from './Chat';
import rehypeRaw from 'rehype-raw';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
  isStreaming?: boolean;
}

// Component to handle stored content
const StoredContent: React.FC<{ contentKey: string; type?: string; alt?: string }> = ({ 
  contentKey, 
  type,
  alt 
}) => {
  const { getOutput } = useThebe();
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchOutput = () => {
      const output = getOutput(contentKey);
      if (output) {
        if (output.type === 'img') {
          setContent(`<img src="${output.content}" alt="${alt || 'Output'}" class="max-w-full my-2 rounded shadow-sm" />`);
        } else if (output.type === 'html') {
          setContent(output.content);
        } else if (output.type === 'svg') {
          setContent(output.content);
        } else {
          setContent(output.content);
        }
      }
    };

    // Initial fetch
    fetchOutput();

    // Set up polling for content that might be added later
    const interval = setInterval(fetchOutput, 500);

    // Clean up interval
    return () => clearInterval(interval);
  }, [contentKey, getOutput, alt]);

  if (!content) return null;

  return <div dangerouslySetInnerHTML={{ __html: content }} />;
};

// Custom markdown components to handle stored content
const MarkdownComponents: Components = {
  div: ({ 
    node,
    children,
    ...props
  }: any) => {
    // Extract data attributes from properties
    const dataType = props['data-type'];
    const dataId = props['data-id'];
    const dataAlt = props['data-alt'];

    if (dataId) {
      return <StoredContent contentKey={dataId} type={dataType} alt={dataAlt} />;
    }
    return <div {...props}>{children}</div>;
  }
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLoading, isStreaming }) => {
  return (
    <div className={`py-6 ${message.role === 'assistant' ? 'bg-gray-50' : ''}`}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8">
            {message.role === 'assistant' ? (
              <div className={`w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            {message.content.map((item, index) => {
              if (item.type === 'markdown') {
                return (
                  <div key={index} className="prose max-w-none break-words overflow-hidden">
                    <ReactMarkdown 
                      components={MarkdownComponents}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {item.content}
                    </ReactMarkdown>
                  </div>
                );
              }
              if (item.type === 'code_execution') {
                return (
                  <div key={index} className="overflow-x-auto">
                    <CodeBlockSelector
                      code={item.content}
                      language={item.attrs?.language || 'python'}
                      defaultCollapsed={true}
                      initialOutputs={item.attrs?.output || []}
                      initialStatus={item.attrs?.status || ''}
                    />
                  </div>
                );
              }
              if (item.type === 'input_audio') {
                return (
                  <div key={index} className="flex items-center gap-2 text-gray-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-sm">Voice message</span>
                  </div>
                );
              }
              return null;
            })}
            {isLoading && (
              <div className="flex gap-2 items-center text-gray-500">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 