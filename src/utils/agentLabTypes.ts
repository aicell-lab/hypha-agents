/**
 * Types specific to AgentLab functionality
 */

import { NotebookMetadata } from '../types/notebook';

export interface KernelInfo {
  kernelId?: string;
  version?: string;
  id?: string; // Legacy support
}

export interface KernelExecutionLog {
  timestamp: number;
  type: 'input' | 'output' | 'error' | 'status';
  content: string;
  cellId?: string;
}

export interface ExecuteCodeCallbacks {
  onOutput?: (output: { 
    type: string; 
    content: string; 
    short_content?: string; 
    attrs?: any 
  }) => void;
  onStatus?: (status: string) => void;
  cellId?: string;
}

export interface KernelManager {
  isReady: boolean;
  kernelStatus: 'idle' | 'busy' | 'starting' | 'error';
  kernelInfo: KernelInfo;
  executeCode: ((code: string, callbacks?: ExecuteCodeCallbacks, timeout?: number) => Promise<void>) | null;
  restartKernel: () => Promise<void>;
  resetKernelState: () => Promise<void>;
  initializeExecuteCode: (deno: any, kernelInfo: KernelInfo) => void;
  addKernelLogEntry: (entry: Omit<KernelExecutionLog, 'timestamp'>) => void;
  kernelExecutionLog: KernelExecutionLog[];
  interruptKernel: () => Promise<boolean>;
  destroyCurrentKernel: () => Promise<void>;
}

export interface ProjectManifest {
  name: string;
  description: string;
  version: string;
  type: string;
  created_at: string;
  filePath?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  files?: any[];
  manifest: ProjectManifest;
}

export interface NotebookOperations {
  saveNotebook: () => Promise<void>;
  loadNotebookContent: (projectId: string | undefined, filePath: string) => Promise<void>;
  loadNotebookFromFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDownloadNotebook: () => void;
  createNotebookFromAgentTemplate: (agentId: string, projectId?: string) => Promise<void>;
  handleCreateNewNotebook: () => Promise<void>;
}

export interface AgentOperations {
  handleCreateAgentTemplate: (agentData: any) => Promise<void>;
  handleEditAgentFromWelcomeScreen: (workspace: string, agentId: string) => Promise<void>;
  handleSaveAgentSettingsToNotebook: (data: any) => void;
  handlePublishAgentFromCanvas: (data: any, isUpdating: boolean) => Promise<string | null>;
}

// Agent operations state interface
export interface AgentOperationsState {
  isCreateAgentDialogOpen: boolean;
  isEditAgentDialogOpen: boolean;
  isPublishing: boolean;
}

// Agent creation dialog data
export interface CreateAgentDialogData {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  requirements?: string[];
  knowledgeBase?: string[];
  navigateToAgent?: boolean;
}

// Edit agent form data
export interface EditAgentFormData {
  agentId?: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  license?: string;
  welcomeMessage?: string;
  initialPrompt?: string;
  systemPrompt?: string;
}

// Agent configuration data
export interface AgentConfigData {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  requirements?: string[];
  initialPrompt?: string;
  welcomeMessage?: string;
  license?: string;
}

export interface CanvasPanelState {
  showCanvasPanel: boolean;
  canvasPanelWidth: number;
  hyphaCoreWindows: any[];
  activeCanvasTab: string | null;
  toggleCanvasPanel: () => void;
  handleCanvasPanelResize: (width: number) => void;
  handleCanvasPanelResizeEnd: () => void;
  handleTabClose: (tabId: string) => void;
  setActiveCanvasTab: (tabId: string | null) => void;
  setHyphaCoreWindows: React.Dispatch<React.SetStateAction<any[]>>;
}

export interface SidebarState {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  setIsSidebarOpen: (open: boolean) => void;
  handleSidebarResize: (width: number) => void;
  handleSidebarResizeEnd: () => void;
} 