// Define different types of cells in our notebook
export type CellType = 'markdown' | 'code' | 'thinking';
export type ExecutionState = 'idle' | 'running' | 'success' | 'error';
export type CellRole = 'user' | 'assistant' | 'system';


export interface OutputItem {
  type: string;
  content: string;
  short_content?: string;
  attrs?: Record<string, any>;
} 

export interface ContentItem {
  type: 'markdown' | 'code_execution' | 'tool_call' | 'image' | 'html' | 'input_audio';
  content: string;
  attrs?: {
    language?: string;
    output?: OutputItem[];
    status?: string;
    transcript?: string | null;
    [key: string]: any;
  };
}
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: ContentItem[];
}


export interface NotebookCell {
  id: string;
  type: CellType;
  content: string;
  language?: string;
  executionCount?: number;
  executionState: ExecutionState;
  output?: OutputItem[];
  role?: CellRole;
  metadata?: {
    collapsed?: boolean;
    scrolled?: boolean;
    trusted?: boolean;
    isNew?: boolean;
    role?: CellRole;
    isEditing?: boolean;
    isCodeVisible?: boolean;
    isOutputVisible?: boolean;
    hasOutput?: boolean;
    userModified?: boolean;
    parent?: string; // ID of the parent cell (for tracking agent responses to user messages)
    staged?: boolean; // Whether this is a staged (uncommitted) cell
  };
}

export interface NotebookMetadata {
  kernelspec: {
    name: string;
    display_name: string;
  };
  language_info: {
    name: string;
    version: string;
  };
  title: string;
  created: string;
  modified: string;
  projectId?: string;
  filePath?: string;
  modelSettings?: any;
  agentArtifact?: {
    id: string;
    version: string;
    name: string;
    description: string;
    manifest?: any;
    config?: any;
  };
}

export interface NotebookData {
  nbformat: number;
  nbformat_minor: number;
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

export interface HyphaCoreWindow {
  id: string;
  src: string;
  name?: string;
}

// Default notebook metadata
export const defaultNotebookMetadata: NotebookMetadata = {
  kernelspec: {
    name: 'python',
    display_name: 'Python'
  },
  language_info: {
    name: 'python',
    version: '3.10'
  },
  title: 'Untitled Chat',
  created: new Date().toISOString(),
  modified: new Date().toISOString()
}; 