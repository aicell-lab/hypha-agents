import Convert from 'ansi-to-html';

// Create ANSI converter instance with custom color scheme
export const ansiConverter = new Convert({
  colors: {
    0: '#000000',
    1: '#e74c3c', // red
    2: '#2ecc71', // green
    3: '#f1c40f', // yellow
    4: '#3498db', // blue
    5: '#9b59b6', // magenta
    6: '#1abc9c', // cyan
    7: '#ecf0f1', // light gray
    8: '#95a5a6', // dark gray
    9: '#e74c3c', // bright red
    10: '#2ecc71', // bright green
    11: '#f1c40f', // bright yellow
    12: '#3498db', // bright blue
    13: '#9b59b6', // bright magenta
    14: '#1abc9c', // bright cyan
    15: '#ecf0f1'  // white
  },
  newline: false // We'll handle newlines separately
});

// Process text content with ANSI color codes
export const processTextOutput = (text: string): string => {
  // Convert ANSI codes to HTML
  const htmlWithAnsi = ansiConverter.toHtml(text);
  
  // Handle line breaks - keep text in a single line unless there's a newline character
  // Filter out empty lines
  const lines = htmlWithAnsi.split('\n').filter((line: string) => line.trim() !== '');
  
  // If it's just a single line, return as-is
  if (lines.length === 1) {
    return `<pre class="output-line">${lines[0]}</pre>`;
  }
  
  // Otherwise, create a proper multi-line output
  return `<pre class="output-multiline">${lines.join('<br>')}</pre>`;
};

// Process all text in the output element for ANSI codes
export const processAnsiInOutputElement = (container: HTMLElement) => {
  // Find all text nodes that might contain ANSI codes
  const textNodes = Array.from(container.querySelectorAll('*'))
    .filter(el => {
      // Get elements that likely contain text with ANSI codes
      const tagName = el.tagName.toLowerCase();
      return (tagName === 'pre' || tagName === 'code' || tagName === 'div') &&
        !el.classList.contains('output-line') && 
        !el.classList.contains('output-multiline');
    });
  
  // Check direct text children of the container
  if (container.childNodes.length > 0 && 
      container.childNodes[0].nodeType === Node.TEXT_NODE) {
    const text = container.textContent || '';
    if (text.includes('[0;') || text.includes('[1;')) {
      const processedContent = processTextOutput(text);
      container.innerHTML = processedContent;
      return; // We've replaced the entire container content
    }
  }
  
  // Process stream-output elements for ANSI codes
  const streamOutputs = container.querySelectorAll('.stream-output');
  streamOutputs.forEach(el => {
    // Process any ANSI codes inside stream outputs
    const text = el.textContent || '';
    if (text.trim() === '') {
      // If it's just empty or whitespace, hide this element
      (el as HTMLElement).style.display = 'none';
      return;
    }
    
    if (text.includes('[0;') || text.includes('[1;') || 
        text.includes('\u001b[') || text.includes('\\u001b[')) {
      try {
        // Convert ANSI to HTML
        const processedHTML = ansiConverter.toHtml(text);
        
        // Filter out empty lines
        const lines = processedHTML.split('\n').filter((line: string) => line.trim() !== '');
        el.innerHTML = lines.join('<br>');
      } catch (error) {
        console.error('Error processing ANSI codes in stream output:', error);
      }
    } else {
      // For regular text without ANSI codes, still handle newlines
      const lines = text.split('\n').filter((line: string) => line.trim() !== '');
      if (lines.length > 0) {
        el.textContent = lines.join('\n');
      } else {
        // Hide completely empty outputs
        (el as HTMLElement).style.display = 'none';
      }
    }
  });
};

// Common output styles as a CSS string (for style tag)
export const outputAreaStyles = `
  .output-area {
    overflow-x: auto;
  }
  
  .output-area pre, 
  .output-area .stream-output,
  .output-area .error-output,
  .output-area .output-line,
  .output-area .output-multiline {
    font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.4;
    padding: 0.5rem;
    margin: 0;
    background-color: #f8f9fa;
    border-radius: 4px;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  
  .output-area .error-output {
    color: #e74c3c;
  }
`; 