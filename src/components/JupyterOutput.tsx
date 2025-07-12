import React, { useEffect, useRef, useState } from 'react';
import { OutputItem } from '../types/notebook';
import { executeScripts } from '../utils/script-utils';

interface JupyterOutputProps {
  outputs: OutputItem[];
  className?: string;
  wrapLongLines?: boolean;
}

export const JupyterOutput: React.FC<JupyterOutputProps> = ({ outputs, className = '', wrapLongLines = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({});

  // Process outputs after rendering - handle scripts and ANSI codes
  useEffect(() => {
    if (containerRef.current) {
      // Execute any scripts and process ANSI codes
      try{
        executeScripts(containerRef.current);
      }
      catch(e){
        console.error(e)
      }
    }
  }, [outputs]);

  // Handle keyboard events to allow copying text from output without triggering parent cell copy
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Ctrl+C (Windows/Linux) or Cmd+C (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        // If there's selected text within the output, stop propagation
        // to prevent parent cell from handling the copy event
        e.stopPropagation();
      }
    }
  };

  // Handle copy events to prevent parent cell from overriding
  const handleCopy = (e: React.ClipboardEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      // If there's selected text, stop propagation to let default copy behavior work
      e.stopPropagation();
    }
  };
  
  // Skip rendering if no outputs
  if (!outputs || outputs.length === 0) {
    return null;
  }
  
  // Separate outputs by type, but ensure both normal and error outputs are always shown
  const textAndErrorOutputs = outputs.filter(o => 
    o.type === 'stdout' || o.type === 'stderr' || o.type === 'text' || o.type === 'error'
  );
  
  const htmlOutputs = outputs.filter(o => 
    o.type === 'html' && !o.attrs?.isRenderedDOM
  );
  
  const imageOutputs = outputs.filter(o => 
    o.type === 'img'
  );
  
  // Check for any special DOM outputs that need to be rendered on their own
  const specialDomOutput = outputs.find(o => 
    o.type === 'html' && o.attrs?.isRenderedDOM
  );

  const toggleOutputExpansion = (outputId: string) => {
    setExpandedOutputs(prev => ({
      ...prev,
      [outputId]: !prev[outputId]
    }));
  };
  
  return (
    <div 
      ref={containerRef} 
      className={`jupyter-output-container output-area ${className} bg-gray-50 rounded-b-md`}
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      tabIndex={-1}
    >
      {/* Render all text and error outputs together - don't separate them */}
      <div className="output-text-group">
        {textAndErrorOutputs.map((output, index) => {
          const outputId = `text-${index}`;
          return (
            <div 
              key={outputId} 
              className={`output-item ${output.attrs?.isProcessedAnsi ? 'ansi-processed' : ''}`}
            >
              {renderOutput(output, wrapLongLines, outputId, expandedOutputs[outputId], toggleOutputExpansion)}
            </div>
          );
        })}
      </div>
      {/* Render HTML outputs next */}
      {htmlOutputs.length > 0 && (
        <div className="output-html-group">
          {htmlOutputs.map((output, index) => {
            const outputId = `html-${index}`;
            return (
              <div key={outputId} className="output-item">
                {renderOutput(output, wrapLongLines, outputId, expandedOutputs[outputId], toggleOutputExpansion)}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Render image outputs */}
      {imageOutputs.length > 0 && (
        <div className="output-image-group">
          {imageOutputs.map((output, index) => {
            const outputId = `img-${index}`;
            return (
              <div key={outputId} className="output-item">
                {renderOutput(output, wrapLongLines, outputId, expandedOutputs[outputId], toggleOutputExpansion)}
              </div>
            );
          })}
        </div>
      )}
      
      {/* If we have a special DOM output that needs special handling, render it last */}
      {specialDomOutput && (
        <div 
          className="output-item output-rendered-dom output-area"
          dangerouslySetInnerHTML={{ __html: specialDomOutput.content }}
        />
      )}
    </div>
  );
};

// Function to render different output types
const renderOutput = (
  output: OutputItem, 
  wrapLongLines = false, 
  outputId: string, 
  isExpanded = false, 
  toggleExpansion?: (id: string) => void
) => {
  const wrapClass = wrapLongLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre';
  
  // Skip rendering if output is just a newline character
  if (output.content === '\n') {
    return null;
  }
  
  // Check if this output has already been processed for ANSI codes
  const isPreProcessed = output.attrs?.isProcessedAnsi === true;

  // Function to handle text content that might need collapsing
  const renderCollapsibleText = (
    content: string, 
    className: string, 
    isHtml = false,
    isErrorType = false
  ) => {
    const lineCount = content.split('\n').length;
    const MAX_LINES = 16;
    
    if (lineCount <= MAX_LINES) {
      // If content is short enough, render it normally
      return isHtml ? (
        <pre className={className} dangerouslySetInnerHTML={{ __html: content }} />
      ) : (
        <pre className={className}>{content}</pre>
      );
    }
    
    // Content is too long, decide whether to collapse it
    const buttonColorClass = isErrorType ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600';
    const collapseButtonColorClass = isErrorType ? 'bg-red-400 hover:bg-red-500' : 'bg-gray-500 hover:bg-gray-600';
    
    if (!isExpanded) {
      // Show only the first MAX_LINES lines
      const truncatedContent = content.split('\n').slice(0, MAX_LINES).join('\n');
      return (
        <>
          {isHtml ? (
            <pre className={className} dangerouslySetInnerHTML={{ __html: truncatedContent }} />
          ) : (
            <pre className={className}>{truncatedContent}</pre>
          )}
          <div className="text-center mt-2 mb-1">
            <button 
              className={`${buttonColorClass} text-white px-3 py-1 rounded text-sm`}
              onClick={() => toggleExpansion && toggleExpansion(outputId)}
            >
              Show all outputs ({lineCount} lines)
            </button>
          </div>
        </>
      );
    } else {
      // Show all content when expanded
      return (
        <>
          {isHtml ? (
            <pre className={className} dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <pre className={className}>{content}</pre>
          )}
          <div className="text-center mt-2 mb-1">
            <button 
              className={`${collapseButtonColorClass} text-white px-3 py-1 rounded text-sm`}
              onClick={() => toggleExpansion && toggleExpansion(outputId)}
            >
              Collapse ({lineCount} lines)
            </button>
          </div>
        </>
      );
    }
  };
  
  switch (output.type) {
    case 'stdout':
      // Render stdout as plain text
      return renderCollapsibleText(
        output.content, 
        `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
        false,
        false
      );
    
    case 'stderr':
      if (isPreProcessed) {
        // Pre-processed ANSI content can be rendered as HTML
        return renderCollapsibleText(
          output.content, 
          `${wrapClass} text-sm py-1 font-mono error-output output-area`,
          true,
          true
        );
      } else {
        // Render stderr as plain text
        return renderCollapsibleText(
          output.content, 
          `text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`,
          false,
          true
        );
      }
    
    case 'error':
      if (isPreProcessed) {
        // Pre-processed ANSI content can be rendered as HTML
        return renderCollapsibleText(
          output.content, 
          `${wrapClass} text-sm py-1 font-mono error-output output-area`,
          true,
          true
        );
      } else {
        // Render error as plain text
        return renderCollapsibleText(
          output.content, 
          `text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`,
          false,
          true
        );
      }
    
    case 'img':
      return <img src={output.content} alt="Output" className="max-w-full my-2 rounded output-area" />;
    
    case 'html':
      // Only html type outputs are rendered as HTML
      return (
        <div 
          className={`py-1 overflow-auto output-area ${output.attrs?.isFinalOutput ? 'final-output' : ''}`}
          dangerouslySetInnerHTML={{ __html: output.content }} 
        />
      );
    
    case 'text':
      if (isPreProcessed) {
        // Pre-processed ANSI content can be rendered as HTML
        return renderCollapsibleText(
          output.content, 
          `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
          true,
          false
        );
      } else {
        // Render text as plain text
        return renderCollapsibleText(
          output.content, 
          `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
          false,
          false
        );
      }
    
    // Additional output types can be handled here
    
    default:
      if (typeof output.content === 'string') {
        if (isPreProcessed) {
          // Pre-processed ANSI content can be rendered as HTML
          return renderCollapsibleText(
            output.content, 
            `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
            true,
            false
          );
        } else {
          // Render default content as plain text
          return renderCollapsibleText(
            output.content, 
            `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
            false,
            false
          );
        }
      }
      return <div className="text-gray-500 text-sm output-area">Unsupported output format</div>;
  }
};