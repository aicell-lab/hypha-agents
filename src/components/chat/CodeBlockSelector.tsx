import React from 'react';
import { InteractiveCodeBlock } from './InteractiveCodeBlock';

interface CodeBlockSelectorProps {
  code: string;
  language?: string;
  defaultCollapsed?: boolean;
  initialOutputs?: Array<{ type: string; content: string; attrs?: any }>;
  initialStatus?: string;
  forceInteractive?: boolean;
}

export const CodeBlockSelector: React.FC<CodeBlockSelectorProps> = ({
  code,
  language = 'python',
  defaultCollapsed = true,
  initialOutputs = [],
  initialStatus = '',
  forceInteractive = false
}) => {
  // Check if we have DOM output in the initialOutputs
  const domOutput = initialOutputs.find(output => 
    output.type === 'html' && output.attrs?.isRenderedDOM
  );
  
  // Extract DOM content if available
  const domContent = domOutput?.content || '';
  
  // Use InteractiveCodeBlock for all code blocks, passing DOM content when available
  return (
    <InteractiveCodeBlock
      code={code}
      language={language}
      defaultCollapsed={defaultCollapsed}
      initialStatus={initialStatus}
      domContent={domContent}
    />
  );
}; 