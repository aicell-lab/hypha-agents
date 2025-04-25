import React, { useEffect, useRef, useState } from 'react';
import { OutputItem } from '../types/notebook';
import { executeScripts } from '../utils/script-utils';
import { processAnsiInOutputElement } from '../utils/ansi-utils';


interface JupyterOutputProps {
  outputs: OutputItem[];
  className?: string;
  wrapLongLines?: boolean;
}

export const JupyterOutput: React.FC<JupyterOutputProps> = ({ outputs, className = '', wrapLongLines = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({});
  const wrapClass = wrapLongLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre';
  
  // Process outputs after rendering - handle scripts and ANSI codes
  useEffect(() => {
    if (containerRef.current) {
      // Execute any scripts and process ANSI codes
      try{
        executeScripts(containerRef.current);
        // Only process ANSI codes for elements that haven't been pre-processed
        const nonProcessedElements = containerRef.current.querySelectorAll('.output-item:not(.ansi-processed)');
        nonProcessedElements.forEach(el => {
          processAnsiInOutputElement(el as HTMLElement);
        });
      }
      catch(e){
        console.error(e)
      }
    }
  }, [outputs]);
  
  // Skip rendering if no outputs
  if (!outputs || outputs.length === 0) {
    return null;
  }
  
  // Group outputs by type for better organization
  const textOutputs = outputs.filter(o => 
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
    >
      {/* Render text outputs first */}
      {textOutputs.length > 0 && (
        <div className="output-text-group">
          {textOutputs.map((output, index) => {
            // Check if this is ANSI pre-processed content
            const hasAnsi = output.content.includes('<span style="color:') || 
                          output.attrs?.isProcessedAnsi === true;
            const outputId = `text-${index}`;
            return (
              <div 
                key={outputId} 
                className={`output-item ${hasAnsi ? 'ansi-processed' : ''}`}
              >
                {hasAnsi ? (
                  <div dangerouslySetInnerHTML={{ __html: output.content }} 
                       className={`text-${output.type === 'stderr' || output.type === 'error' ? 'red-600' : 'gray-700'} ${wrapClass} text-sm py-1 font-mono ${output.type === 'stderr' || output.type === 'error' ? 'error-output' : ''} output-area`} />
                ) : (
                  renderOutput(output, wrapLongLines, outputId, expandedOutputs[outputId], toggleOutputExpansion)
                )}
              </div>
            );
          })}
        </div>
      )}
      
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

// Function to detect and wrap URLs in text content
const processURLs = (content: string): string => {
  // URL regex pattern that matches common URL formats
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  
  // Replace URLs with anchor tags
  return content.replace(urlPattern, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${url}</a>`;
  });
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
    isHtml = false
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
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
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
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
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
      // Process URLs in stdout content
      const processedStdout = processURLs(output.content);
      return renderCollapsibleText(
        processedStdout, 
        `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
        processedStdout !== output.content
      );
    
    case 'stderr':
      if (isPreProcessed) {
        return renderCollapsibleText(
          output.content, 
          `text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area ansi-processed`,
          true
        );
      } else {
        // Process URLs in stderr content
        const processedStderr = processURLs(output.content);
        return renderCollapsibleText(
          processedStderr, 
          `text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`,
          processedStderr !== output.content
        );
      }
    
    case 'error':
      if (isPreProcessed) {
        return renderCollapsibleText(
          output.content, 
          `text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area ansi-processed`,
          true
        );
      } else {
        // Process URLs in error content
        const processedError = processURLs(output.content);
        return renderCollapsibleText(
          processedError, 
          `text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`,
          processedError !== output.content
        );
      }
    
    case 'img':
      return <img src={output.content} alt="Output" className="max-w-full my-2 rounded output-area" />;
    
    case 'html':
      return (
        <div 
          className={`py-1 overflow-auto output-area ${output.attrs?.isFinalOutput ? 'final-output' : ''}`}
          dangerouslySetInnerHTML={{ __html: output.content }} 
        />
      );
    
    case 'text':
      if (isPreProcessed) {
        return renderCollapsibleText(
          output.content, 
          `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area ansi-processed`,
          true
        );
      } else {
        // Process URLs in text content
        const processedText = processURLs(output.content);
        return renderCollapsibleText(
          processedText, 
          `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
          processedText !== output.content
        );
      }
    
    // Additional output types can be handled here
    
    default:
      if (typeof output.content === 'string') {
        if (isPreProcessed) {
          return renderCollapsibleText(
            output.content, 
            `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area ansi-processed`,
            true
          );
        } else {
          // Process URLs in default content
          const processedDefault = processURLs(output.content);
          return renderCollapsibleText(
            processedDefault, 
            `text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`,
            processedDefault !== output.content
          );
        }
      }
      return <div className="text-gray-500 text-sm output-area">Unsupported output format</div>;
  }
};