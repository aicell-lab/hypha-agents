{executionState && (
  <div className={`output-container flex flex-col mt-2 w-full overflow-auto ${
    executionState.status === 'error' ? 'error' : ''
  }`}>
    {executionState.outputs && executionState.outputs.length > 0 && (
      <div className="output-area w-full">
        <JupyterOutput 
          outputs={executionState.outputs} 
          className="w-full"
          wrapLongLines={true}
        />
      </div>
    )}
    {executionState.status === 'running' && (
      <div className="running-indicator text-xs text-gray-500 mt-1">
        Running...
      </div>
    )}
  </div>
)} 