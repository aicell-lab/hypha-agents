import React, { useEffect } from 'react';
import Plot from 'react-plotly.js';
import 'plotly.js-dist/plotly'; // Import Plotly.js directly

interface Output {
  type: string;
  content: string;
  attrs?: any;
}

interface OutputDisplayProps {
  outputs: Output[];
  theme?: 'light' | 'dark';
}

const OutputDisplay: React.FC<OutputDisplayProps> = React.memo(({ outputs, theme = 'light' }) => {
  return (
    <div className={`output-display ${theme}`}>
      {outputs.map((output, index) => {
        switch (output.type) {
          case 'stdout':
          case 'stderr':
            return (
              <pre key={`${output.type}-${index}`} className={`${output.type} ${theme}`}>
                {output.content}
              </pre>
            );
          case 'img':
            return (
              <img 
                key={`img-${index}`} 
                src={output.content} 
                alt="Output" 
                className="max-w-full"
                {...output.attrs}
              />
            );
          case 'html':
            return (
              <div 
                key={`html-${index}`}
                dangerouslySetInnerHTML={{ __html: output.content }}
                {...output.attrs}
              />
            );
          case 'service':
            return (
              <div key={`service-${index}`} className="service-info">
                <p>Service registered: {output.content}</p>
                {output.attrs && (
                  <pre className="text-xs mt-1">
                    {JSON.stringify(output.attrs, null, 2)}
                  </pre>
                )}
              </div>
            );
          case 'plotly':
            try {
              const fig = JSON.parse(output.content);
              return (
                <div key={`plotly-${fig.layout.title}-${index}`} className="plotly-container my-4">
                  <Plot
                    key={`plotly-${fig.layout.title}-${index}`}
                    data={fig.data}
                    layout={fig.layout}
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
              return (
                <pre key={`error-${index}`} className="text-red-500">
                  Error rendering Plotly figure: {e.message}
                </pre>
              );
            }
          default:
            return (
              <div key={`unknown-${index}`} className="unknown-output">
                {output.content}
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
