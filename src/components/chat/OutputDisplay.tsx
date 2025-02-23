import React from 'react';
import Plot from 'react-plotly.js';

interface Output {
  type: string;
  content: string;
  attrs?: any;
}

interface OutputDisplayProps {
  outputs: Output[];
  theme?: 'light' | 'dark';
}

// Function to strip ANSI color codes
const stripAnsi = (str: string) => {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
};

// Function to format Python traceback
const formatTraceback = (content: string): string => {
  const lines = content.split('\n');
  let formatted = '';
  let inTraceback = false;

  for (const line of lines) {
    const stripped = stripAnsi(line);

    // Skip empty lines
    if (!stripped.trim()) continue;

    if (stripped.includes('Traceback (most recent call last)')) {
      inTraceback = true;
      formatted += 'Error: ';
      continue;
    }

    if (inTraceback) {
      // Extract the error message
      if (stripped.match(/^\w+Error:/)) {
        formatted += stripped + '\n';
        continue;
      }

      // Extract relevant file and line info
      const match = stripped.match(/File "([^"]+)", line (\d+)/);
      if (match) {
        formatted += `at ${match[1]}:${match[2]}\n`;
        continue;
      }

      // Include the actual code line if it's not a File line
      if (!stripped.startsWith('File ')) {
        formatted += stripped.trim() + '\n';
      }
    } else {
      formatted += stripped + '\n';
    }
  }

  return formatted.trim();
};

const OutputDisplay: React.FC<OutputDisplayProps> = React.memo(({ outputs, theme = 'light' }) => {
  return (
    <div className={`output-display ${theme}`}>
      {outputs.map((output, index) => {
        switch (output.type) {
          case 'stdout':
          case 'stderr':
            const content = output.type === 'stderr' 
              ? formatTraceback(output.content)
              : stripAnsi(output.content);
            
            return (
              <pre 
                key={`${output.type}-${index}`} 
                className={`${output.type} ${theme} p-2 rounded font-mono text-sm whitespace-pre-wrap ${
                  output.type === 'stderr' 
                    ? 'text-red-600 bg-red-50 border border-red-200' 
                    : 'text-gray-800 bg-gray-50'
                }`}
              >
                {content}
              </pre>
            );
          case 'img':
            return (
              <img 
                key={`img-${index}`} 
                src={output.content} 
                alt="Output" 
                className="max-w-full my-2 rounded shadow-sm"
                {...output.attrs}
              />
            );
          case 'html':
            return (
              <div 
                key={`html-${index}`}
                className="my-2 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: output.content }}
                {...output.attrs}
              />
            );
          case 'svg':
            return (
              <div 
                key={`svg-${index}`}
                className="my-2"
                dangerouslySetInnerHTML={{ __html: output.content }}
                {...output.attrs}
              />
            );
          case 'plotly':
            try {
              const fig = JSON.parse(output.content);
              return (
                <div key={`plotly-${index}`} className="my-4">
                  <Plot
                    data={fig.data}
                    layout={{
                      ...fig.layout,
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      font: {
                        color: theme === 'dark' ? '#E5E7EB' : '#1F2937'
                      },
                      margin: { t: 30, r: 10, b: 30, l: 60 }
                    }}
                    config={{
                      responsive: true,
                      displayModeBar: true,
                      scrollZoom: true
                    }}
                    style={{width: '100%', height: '400px'}}
                    useResizeHandler={true}
                  />
                </div>
              );
            } catch (e) {
              const error = e as Error;
              return (
                <pre key={`error-${index}`} className="text-red-500 p-2 bg-red-50 rounded">
                  Error rendering Plotly figure: {error.message}
                </pre>
              );
            }
          case 'audio':
            return (
              <audio 
                key={`audio-${index}`}
                controls
                src={output.content}
                className="my-2 w-full"
                {...output.attrs}
              />
            );
          case 'service':
            return (
              <div key={`service-${index}`} className="service-info bg-blue-50 p-2 rounded my-2">
                <p className="text-blue-700">Service registered: {output.content}</p>
                {output.attrs && (
                  <pre className="text-xs mt-1 text-blue-600 overflow-x-auto">
                    {JSON.stringify(output.attrs, null, 2)}
                  </pre>
                )}
              </div>
            );
          default:
            return (
              <div key={`unknown-${index}`} className="unknown-output p-2 bg-gray-50 rounded my-2">
                {stripAnsi(output.content)}
              </div>
            );
        }
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if outputs or theme change
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.outputs.length === nextProps.outputs.length &&
    prevProps.outputs.every((out, i) => 
      out.type === nextProps.outputs[i]?.type &&
      out.content === nextProps.outputs[i]?.content
    )
  );
});

export default OutputDisplay; 