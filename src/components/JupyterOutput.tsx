import React, { useEffect, useRef } from 'react';
import { OutputItem as ChatOutputItem } from './chat/Chat';
import { executeScripts } from '../utils/script-utils';
import { processAnsiInOutputElement } from '../utils/ansi-utils';

// Export this type for other components to use
export type OutputItem = ChatOutputItem;

type OutputTypes = 'stdout' | 'stderr' | 'img' | 'display_data' | 'execute_result' | 'error' | 'html' | 'text';

interface JupyterOutputProps {
  outputs: OutputItem[];
  className?: string;
  wrapLongLines?: boolean;
}

export const JupyterOutput: React.FC<JupyterOutputProps> = ({ outputs, className = '', wrapLongLines = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
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
  
  return (
    <div 
      ref={containerRef} 
      className={`jupyter-output-container output-area ${className} bg-gray-50 rounded-b-md`}
      // Stop click propagation to allow text selection
      onClick={(e) => e.stopPropagation()} 
      // Also stop mousedown propagation to prevent focus shifts during selection
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Render text outputs first */}
      {textOutputs.length > 0 && (
        <div className="output-text-group">
          {textOutputs.map((output, index) => {
            // Check if this is ANSI pre-processed content
            const hasAnsi = output.content.includes('<span style="color:') || 
                          output.attrs?.isProcessedAnsi === true;
            return (
              <div 
                key={`text-${index}`} 
                className={`output-item ${hasAnsi ? 'ansi-processed' : ''}`}
              >
                {hasAnsi ? (
                  <div dangerouslySetInnerHTML={{ __html: output.content }} 
                       className={`text-${output.type === 'stderr' || output.type === 'error' ? 'red-600' : 'gray-700'} ${wrapClass} text-sm py-1 font-mono ${output.type === 'stderr' || output.type === 'error' ? 'error-output' : ''} output-area`} />
                ) : (
                  renderOutput(output, wrapLongLines)
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Render HTML outputs next */}
      {htmlOutputs.length > 0 && (
        <div className="output-html-group">
          {htmlOutputs.map((output, index) => (
            <div key={`html-${index}`} className="output-item">
              {renderOutput(output, wrapLongLines)}
            </div>
          ))}
        </div>
      )}
      
      {/* Render image outputs */}
      {imageOutputs.length > 0 && (
        <div className="output-image-group">
          {imageOutputs.map((output, index) => (
            <div key={`img-${index}`} className="output-item">
              {renderOutput(output, wrapLongLines)}
            </div>
          ))}
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
const renderOutput = (output: OutputItem, wrapLongLines = false) => {
  const wrapClass = wrapLongLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre';
  
  // Skip rendering if output is just a newline character
  if (output.content === '\n') {
    return null;
  }
  
  // Check if this output has already been processed for ANSI codes
  const isPreProcessed = output.attrs?.isProcessedAnsi === true;
  
  switch (output.type) {
    case 'stdout':
      // Process URLs in stdout content
      const processedStdout = processURLs(output.content);
      return processedStdout !== output.content ? (
        <pre 
          className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`}
          dangerouslySetInnerHTML={{ __html: processedStdout }}
        />
      ) : (
        <pre className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`}>{output.content}</pre>
      );
    
    case 'stderr':
      if (isPreProcessed) {
        return (
          <pre 
            className={`text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area ansi-processed`}
            dangerouslySetInnerHTML={{ __html: output.content }}
          />
        );
      } else {
        // Process URLs in stderr content
        const processedStderr = processURLs(output.content);
        return processedStderr !== output.content ? (
          <pre 
            className={`text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`}
            dangerouslySetInnerHTML={{ __html: processedStderr }}
          />
        ) : (
          <pre className={`text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`}>{output.content}</pre>
        );
      }
    
    case 'error':
      if (isPreProcessed) {
        return (
          <pre 
            className={`text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area ansi-processed`}
            dangerouslySetInnerHTML={{ __html: output.content }}
          />
        );
      } else {
        // Process URLs in error content
        const processedError = processURLs(output.content);
        return processedError !== output.content ? (
          <pre 
            className={`text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`}
            dangerouslySetInnerHTML={{ __html: processedError }}
          />
        ) : (
          <pre className={`text-red-600 ${wrapClass} text-sm py-1 font-mono error-output output-area`}>{output.content}</pre>
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
        return (
          <pre 
            className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area ansi-processed`}
            dangerouslySetInnerHTML={{ __html: output.content }}
          />
        );
      } else {
        // Process URLs in text content
        const processedText = processURLs(output.content);
        return processedText !== output.content ? (
          <pre 
            className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`}
            dangerouslySetInnerHTML={{ __html: processedText }}
          />
        ) : (
          <pre className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`}>{output.content}</pre>
        );
      }
    
    // Additional output types can be handled here
    
    default:
      if (typeof output.content === 'string') {
        if (isPreProcessed) {
          return (
            <pre 
              className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area ansi-processed`}
              dangerouslySetInnerHTML={{ __html: output.content }}
            />
          );
        } else {
          // Process URLs in default content
          const processedDefault = processURLs(output.content);
          return processedDefault !== output.content ? (
            <pre 
              className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`}
              dangerouslySetInnerHTML={{ __html: processedDefault }}
            />
          ) : (
            <pre className={`text-gray-700 ${wrapClass} text-sm py-1 font-mono output-area`}>{output.content}</pre>
          );
        }
      }
      return <div className="text-gray-500 text-sm output-area">Unsupported output format</div>;
  }
};