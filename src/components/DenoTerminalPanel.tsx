import React, { useState } from 'react';

interface DenoTerminalPanelProps {
  server?: any;
  kernelInfo?: any;
  executeCode?: any;
}

export const DenoTerminalPanel: React.FC<DenoTerminalPanelProps> = ({
  server,
  kernelInfo,
  executeCode
}) => {
  const [output, setOutput] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  
  const handleRunCommand = async () => {
    if (!command.trim() || !server || !kernelInfo?.kernelId) return;
    
    try {
      setOutput(prev => [...prev, `> ${command}`]);
      
      // Execute the command and collect output
      if (executeCode) {
        await executeCode(command, {
          onOutput: (output: any) => {
            if (output.content) {
              setOutput(prev => [...prev, output.content]);
            }
          },
          onStatus: (status: any) => {
            console.log('Terminal command status:', status);
          }
        });
      }
      
      setCommand('');
    } catch (error) {
      console.error('Terminal error:', error);
      setOutput(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`]);
    }
  };
  
  return (
    <div className="p-4 bg-black text-green-400 h-full flex flex-col">
      <div className="flex-1 overflow-auto font-mono whitespace-pre-wrap">
        {output.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div className="mt-2 flex">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
          className="flex-1 bg-black text-green-400 border border-green-500 p-2"
          placeholder="Enter JavaScript/TypeScript command..."
        />
        <button 
          onClick={handleRunCommand}
          className="ml-2 bg-green-800 text-white px-4 py-2"
        >
          Run
        </button>
      </div>
    </div>
  );
}; 