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
  
  // Apply output-area class to all outputs for consistent styling
  const processedOutputs = initialOutputs.map(output => {
    // Add output-area class to attrs if it doesn't have it
    return {
      ...output,
      attrs: {
        ...output.attrs,
        className: `output-area ${output.attrs?.className || ''}`
      }
    };
  });
  
  // Extract DOM content if available
  const domContent = domOutput?.content || '';
  
  // Use InteractiveCodeBlock for all code blocks, passing DOM content when available
  return (
    <div className="code-block-container">
      <InteractiveCodeBlock
        code={code}
        language={language}
        defaultCollapsed={defaultCollapsed}
        initialStatus={initialStatus}
        domContent={domContent}
        initialOutputs={processedOutputs}
      />
    </div>
  );
}; 