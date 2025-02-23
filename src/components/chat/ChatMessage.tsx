import React from 'react';
import ReactMarkdown from 'react-markdown';
import { UserIcon } from './icons/UserIcon';
import { BotIcon } from './icons/BotIcon';
import { CodeBlock } from './CodeBlock';

interface ContentItem {
  type: 'markdown' | 'code_execution' | 'tool_call' | 'image' | 'html';
  content: string;
  attrs?: {
    language?: string;
    output?: string;
    [key: string]: any;
  };
}

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: ContentItem[];
  };
  isLoading?: boolean;
}

interface CodeNodeChild {
  type: string;
  tagName?: string;
  value?: string;
  children?: Array<{ type: string; value?: string }>;
  properties?: {
    className?: string[];
  };
}

interface CodeNode {
  type: string;
  children?: CodeNodeChild[];
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  isLoading
}) => {
  const isUser = message.role === 'user';

  const renderContentItem = (item: ContentItem, index: number) => {
    switch (item.type) {
      case 'markdown':
        return (
          <ReactMarkdown
            key={index}
            className={`prose max-w-none ${isLoading ? 'opacity-60' : ''}`}
            components={{
              pre: ({ node, ...props }) => {
                const codeNode = (node as unknown as CodeNode).children?.[0];
                if (codeNode?.type === 'element' && codeNode.tagName === 'code') {
                  const code = codeNode.children?.[0]?.value || '';
                  const language = codeNode.properties?.className?.[0]?.replace('language-', '') || 'python';
                  return <CodeBlock code={code} language={language} defaultCollapsed={true} />;
                }
                return (
                  <div className="overflow-auto bg-gray-900 text-gray-100 p-4 rounded-lg my-2">
                    <pre {...props} />
                  </div>
                );
              },
              code: ({ inline, ...props }: { inline?: boolean } & React.HTMLProps<HTMLElement>) =>
                inline ? (
                  <code className="bg-gray-100 text-gray-900 px-1 py-0.5 rounded" {...props} />
                ) : (
                  <code {...props} />
                ),
            }}
          >
            {item.content}
          </ReactMarkdown>
        );
      
      case 'code_execution':
        return (
          <div key={index} className="relative rounded-lg overflow-hidden bg-white border border-gray-200">
            {/* Code block */}
            <div className="relative">
              <div className="pt-2">
                <CodeBlock
                  code={item.content}
                  language={item.attrs?.language || 'python'}
                  defaultCollapsed={false}
                />
              </div>
            </div>

            {/* Output block - only show if there's output */}
            {item.attrs?.output && (
              <div className="border-t border-gray-100">
                <div className="px-4 py-2 bg-gray-50">
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500">Output</span>
                  </div>
                  <pre className="mt-2 text-sm text-gray-700 font-mono whitespace-pre-wrap">{item.attrs.output}</pre>
                </div>
              </div>
            )}
          </div>
        );
      
      case 'tool_call':
        return (
          <div key={index} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-medium text-blue-700">Tool Call</span>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-blue-700 font-mono">{item.content}</pre>
          </div>
        );
      
      case 'image':
        return (
          <div key={index} className="my-2">
            <img src={item.content} alt={item.attrs?.alt || 'Generated image'} className="max-w-full rounded-lg" />
          </div>
        );
      
      case 'html':
        return (
          <div key={index} className="my-2" dangerouslySetInnerHTML={{ __html: item.content }} />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`flex gap-4 p-6 ${isUser ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-blue-600" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <BotIcon className="w-5 h-5 text-purple-600" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="font-medium text-sm text-gray-500">
          {isUser ? 'You' : 'Assistant'}
        </div>
        {message.content.map((item, index) => renderContentItem(item, index))}
      </div>
    </div>
  );
}; 