import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface Tool {
  type: 'function';
  name: string;
  description: string;
  icon?: string; // Optional icon for the tool
  category?: string; // Optional category for grouping tools
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  fn: (args: any) => Promise<any>;
}

interface ToolContextType {
  tools: Tool[];
  registerTool: (tool: Tool) => void;
  registerTools: (tools: Tool[]) => void;
  unregisterTool: (toolName: string) => void;
  getToolByName: (toolName: string) => Tool | undefined;
  getToolsByCategory: (category: string) => Tool[];
  onToolsChange: (callback: (tools: Tool[]) => void) => () => void;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export const useTools = () => {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error('useTools must be used within a ToolProvider');
  }
  return context;
};

interface ToolProviderProps {
  children: React.ReactNode;
}

export const ToolProvider: React.FC<ToolProviderProps> = ({ children }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const toolsRef = useRef<Record<string, Tool>>({});
  const changeListenersRef = useRef<Set<(tools: Tool[]) => void>>(new Set());

  // Notify all listeners when tools change
  const notifyToolsChange = useCallback(() => {
    const toolsList = Object.values(toolsRef.current);
    changeListenersRef.current.forEach(listener => {
      try {
        listener(toolsList);
      } catch (error) {
        console.error('Error in tool change listener:', error);
      }
    });
  }, []);

  // Register a single tool
  const registerTool = useCallback((tool: Tool) => {
    toolsRef.current[tool.name] = tool;
    setTools(Object.values(toolsRef.current));
    notifyToolsChange();
  }, [notifyToolsChange]);

  // Register multiple tools at once
  const registerTools = useCallback((newTools: Tool[]) => {
    let hasChanges = false;
    
    newTools.forEach(tool => {
      // Only update if the tool is new or different
      const existingTool = toolsRef.current[tool.name];
      if (!existingTool || JSON.stringify(existingTool) !== JSON.stringify(tool)) {
        toolsRef.current[tool.name] = tool;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setTools(Object.values(toolsRef.current));
      notifyToolsChange();
    }
  }, [notifyToolsChange]);

  // Unregister a tool by name
  const unregisterTool = useCallback((toolName: string) => {
    if (toolsRef.current[toolName]) {
      delete toolsRef.current[toolName];
      setTools(Object.values(toolsRef.current));
      notifyToolsChange();
    }
  }, [notifyToolsChange]);

  // Get a tool by name
  const getToolByName = useCallback((toolName: string) => {
    return toolsRef.current[toolName];
  }, []);

  // Get tools by category
  const getToolsByCategory = useCallback((category: string) => {
    return Object.values(toolsRef.current).filter(tool => tool.category === category);
  }, []);

  // Register a callback to be notified when tools change
  const onToolsChange = useCallback((callback: (tools: Tool[]) => void) => {
    changeListenersRef.current.add(callback);
    
    // Return a function to unregister the callback
    return () => {
      changeListenersRef.current.delete(callback);
    };
  }, []);

  return (
    <ToolContext.Provider value={{
      tools,
      registerTool,
      registerTools,
      unregisterTool,
      getToolByName,
      getToolsByCategory,
      onToolsChange
    }}>
      {children}
    </ToolContext.Provider>
  );
}; 