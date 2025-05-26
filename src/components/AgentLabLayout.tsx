import React from 'react';
import { NotebookCell, NotebookMetadata } from './../types/notebook';
import { HyphaCoreWindow } from './notebook/CanvasPanel';

// Import components
import NotebookHeader from './notebook/NotebookHeader';
import NotebookContent from './notebook/NotebookContent';
import NotebookFooter from './notebook/NotebookFooter';
import KeyboardShortcutsDialog from './notebook/KeyboardShortcutsDialog';
import WelcomeScreen from './notebook/WelcomeScreen';
import Sidebar from './notebook/Sidebar';
import { CanvasPanel } from './notebook/CanvasPanel';

// Import hook types
import { InitialUrlParams } from '../hooks/useNotebookInitialization';

interface AgentLabLayoutProps {
  // Core state
  cells: NotebookCell[];
  notebookMetadata: NotebookMetadata;
  activeCellId: string | null;
  isLoggedIn: boolean;
  showWelcomeScreen: boolean;
  isShortcutsDialogOpen: boolean;
  setIsShortcutsDialogOpen: (open: boolean) => void;
  
  // Notebook operations
  notebookFileName: string;
  onSave: () => Promise<void>;
  onDownload: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRunAll: () => Promise<void>;
  onClearOutputs: () => void;
  onRestartKernel: () => Promise<void>;
  onInterruptKernel: () => Promise<void>;
  onAddCodeCell: () => void;
  onAddMarkdownCell: () => void;
  onCreateNewNotebook: () => Promise<void>;
  onCreateAgentTemplate: (agentData: any) => Promise<void>;
  onEditAgent: (workspace: string, agentId: string) => Promise<void>;
  onStartFromAgent: (agentId: string, projectId?: string) => Promise<void>;
  onOpenFile: (projectId: string | undefined, filePath: string) => Promise<void>;
  
  // Cell operations
  onActiveCellChange: (id: string) => void;
  onExecuteCell: (id: string) => Promise<string>;
  onUpdateCellContent: (id: string, content: string) => void;
  onToggleCellEditing: (id: string, editing: boolean) => void;
  onToggleCodeVisibility: (id: string) => void;
  onToggleOutputVisibility: (id: string) => void;
  onChangeCellType: (id: string, cellType: any) => void;
  onUpdateCellRole: (id: string, role: any) => void;
  onDeleteCell: (id: string) => void;
  onDeleteCellWithChildren: (id: string) => void;
  onToggleCellCommitStatus: (id: string) => void;
  onRegenerateClick: (cellId: string) => Promise<void>;
  onStopChatCompletion: () => void;
  getEditorRef: (cellId: string) => React.RefObject<any>;
  onMoveCellUp: () => void;
  onMoveCellDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  
  // Sidebar state
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  sidebarWidth: number;
  onSidebarResize: (width: number) => void;
  onSidebarResizeEnd: () => void;
  onLoadNotebook: (project: any, file: any) => Promise<void>;
  
  // Canvas panel state
  showCanvasPanel: boolean;
  canvasPanelWidth: number;
  hyphaCoreWindows: HyphaCoreWindow[];
  activeCanvasTab: string | null;
  onCanvasPanelResize: (width: number) => void;
  onCanvasPanelResizeEnd: () => void;
  onCanvasPanelClose: () => void;
  onCanvasTabChange: (tabId: string | null) => void;
  onCanvasTabClose: (tabId: string) => void;
  
  // Footer and messaging
  onSendMessage: (message: string) => void;
  onAbortExecution: () => void;
  onShowTerminal: () => void;
  onModelSettingsChange: () => void;
  onShowEditAgent: () => void;
  
  // Status
  isProcessing: boolean;
  isReady: boolean;
  kernelStatus: 'idle' | 'busy' | 'starting' | 'error';
  isAIReady: boolean;
  initializationError: string | null;
  activeAbortController: any;
  
  // URL params
  parsedUrlParams: InitialUrlParams | null;
}

export const AgentLabLayout: React.FC<AgentLabLayoutProps> = ({
  // Core state
  cells,
  notebookMetadata,
  activeCellId,
  isLoggedIn,
  showWelcomeScreen,
  isShortcutsDialogOpen,
  setIsShortcutsDialogOpen,
  
  // Notebook operations
  notebookFileName,
  onSave,
  onDownload,
  onLoad,
  onRunAll,
  onClearOutputs,
  onRestartKernel,
  onInterruptKernel,
  onAddCodeCell,
  onAddMarkdownCell,
  onCreateNewNotebook,
  onCreateAgentTemplate,
  onEditAgent,
  onStartFromAgent,
  onOpenFile,
  
  // Cell operations
  onActiveCellChange,
  onExecuteCell,
  onUpdateCellContent,
  onToggleCellEditing,
  onToggleCodeVisibility,
  onToggleOutputVisibility,
  onChangeCellType,
  onUpdateCellRole,
  onDeleteCell,
  onDeleteCellWithChildren,
  onToggleCellCommitStatus,
  onRegenerateClick,
  onStopChatCompletion,
  getEditorRef,
  onMoveCellUp,
  onMoveCellDown,
  canMoveUp,
  canMoveDown,
  
  // Sidebar state
  isSidebarOpen,
  onToggleSidebar,
  sidebarWidth,
  onSidebarResize,
  onSidebarResizeEnd,
  onLoadNotebook,
  
  // Canvas panel state
  showCanvasPanel,
  canvasPanelWidth,
  hyphaCoreWindows,
  activeCanvasTab,
  onCanvasPanelResize,
  onCanvasPanelResizeEnd,
  onCanvasPanelClose,
  onCanvasTabChange,
  onCanvasTabClose,
  
  // Footer and messaging
  onSendMessage,
  onAbortExecution,
  onShowTerminal,
  onModelSettingsChange,
  onShowEditAgent,
  
  // Status
  isProcessing,
  isReady,
  kernelStatus,
  isAIReady,
  initializationError,
  activeAbortController,
  
  // URL params
  parsedUrlParams
}) => {
  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <NotebookHeader
        metadata={notebookMetadata}
        fileName={notebookFileName}
        onMetadataChange={() => {}} // This will be handled by parent
        onSave={onSave}
        onDownload={onDownload}
        onLoad={onLoad}
        onRunAll={onRunAll}
        onClearOutputs={onClearOutputs}
        onRestartKernel={onRestartKernel}
        onInterruptKernel={onInterruptKernel}
        onAddCodeCell={onAddCodeCell}
        onAddMarkdownCell={onAddMarkdownCell}
        onShowKeyboardShortcuts={() => setIsShortcutsDialogOpen(true)}
        isProcessing={isProcessing}
        isKernelReady={isReady}
        isAIReady={isAIReady}
        onToggleSidebar={onToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        onMoveCellUp={onMoveCellUp}
        onMoveCellDown={onMoveCellDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        isWelcomeScreen={showWelcomeScreen}
        kernelStatus={kernelStatus}
        onRetryKernel={onRestartKernel}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={onToggleSidebar}
          onLoadNotebook={onLoadNotebook}
          onResize={onSidebarResize}
          onResizeEnd={onSidebarResizeEnd}
          width={sidebarWidth}
        />

        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden transition-all duration-300">
          {showWelcomeScreen ? (
            <WelcomeScreen
              urlParams={parsedUrlParams}
              isLoggedIn={isLoggedIn}
              onStartNewChat={onCreateNewNotebook}
              onStartFromAgent={onStartFromAgent}
              onCreateAgentTemplate={onCreateAgentTemplate}
              onEditAgent={onEditAgent}
              onOpenFile={onOpenFile}
            />
          ) : (
            <>
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="max-w-5xl mx-auto px-0 sm:px-4 py-1 pb-48">
                      <NotebookContent
                        cells={cells}
                        activeCellId={activeCellId || ''}
                        onActiveCellChange={onActiveCellChange}
                        onExecuteCell={onExecuteCell}
                        onUpdateCellContent={onUpdateCellContent}
                        onToggleCellEditing={onToggleCellEditing}
                        onToggleCodeVisibility={onToggleCodeVisibility}
                        onToggleOutputVisibility={onToggleOutputVisibility}
                        onChangeCellType={onChangeCellType}
                        onUpdateCellRole={onUpdateCellRole}
                        onDeleteCell={onDeleteCell}
                        onDeleteCellWithChildren={onDeleteCellWithChildren}
                        onToggleCellCommitStatus={onToggleCellCommitStatus}
                        onRegenerateClick={onRegenerateClick}
                        onStopChatCompletion={onAbortExecution}
                        getEditorRef={getEditorRef}
                        isReady={isReady}
                        activeAbortController={activeAbortController}
                        showCanvasPanel={showCanvasPanel}
                        onAbortExecution={onAbortExecution}
                      />
                    </div>
                  </div>

                  <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm pt-1 px-4 pb-4 shadow-md z-100">
                    <NotebookFooter
                      onSendMessage={onSendMessage}
                      onStopChatCompletion={onAbortExecution}
                      isProcessing={isProcessing}
                      isThebeReady={isReady}
                      isAIReady={isAIReady}
                      initializationError={initializationError}
                      onShowThebeTerminal={onShowTerminal}
                      onModelSettingsChange={onModelSettingsChange}
                      onShowEditAgent={onShowEditAgent}
                    />
                  </div>
                </div>

                <CanvasPanel
                  windows={hyphaCoreWindows}
                  isVisible={showCanvasPanel}
                  activeTab={activeCanvasTab}
                  onResize={onCanvasPanelResize}
                  onResizeEnd={onCanvasPanelResizeEnd}
                  onClose={onCanvasPanelClose}
                  onTabChange={onCanvasTabChange}
                  onTabClose={onCanvasTabClose}
                  defaultWidth={canvasPanelWidth}
                />
              </div>

              <KeyboardShortcutsDialog
                isOpen={isShortcutsDialogOpen}
                onClose={() => setIsShortcutsDialogOpen(false)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 