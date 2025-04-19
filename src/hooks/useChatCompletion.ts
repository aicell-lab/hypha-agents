import { useState, useCallback, useRef } from 'react';
import { chatCompletion, ChatMessage, AgentSettings } from '../utils/chatCompletion';
import { CellManager } from '../pages/CellManager';
import { showToast } from '../utils/notebookUtils';
import { NotebookCell } from '../types/notebook';

interface UseChatCompletionProps {
  cellManager: CellManager;
  executeCode: (completionId: string, script: string, cellId?: string) => Promise<string>;
  agentSettings: AgentSettings;
  getConversationHistory: (upToCellId?: string) => ChatMessage[];
  isReady: boolean;
  setCells: React.Dispatch<React.SetStateAction<NotebookCell[]>>;
}

export function useChatCompletion({
  cellManager,
  executeCode,
  agentSettings,
  getConversationHistory,
  isReady,
  setCells
}: UseChatCompletionProps) {
  const [isProcessingAgentResponse, setIsProcessingAgentResponse] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [activeAbortController, setActiveAbortController] = useState<AbortController | null>(null);
  const lastUserCellRef = useRef<string | null>(null);
  const cells = cellManager.getCurrentCellsContent();

  // Handle executing code during chat completion
  const handleExecuteCode = useCallback(async (completionId: string, code: string, cellId?: string): Promise<string> => {
    let actualCellId = cellId;
    try {
      if (actualCellId) {
        // Update the existing code cell with the new code
        const existingCell = cellManager.findCell(c => c.id === actualCellId);
        if (!existingCell) {
          console.error('[DEBUG] Cell not found:', actualCellId);
          return `[Cell Id: ${actualCellId}] Runtime Error: cell not found`;
        }
        cellManager.updateCellContent(actualCellId, code);
        console.log('[DEBUG] Updated code cell:', actualCellId);
      } else {
        // Create a new code cell only if one doesn't exist
        actualCellId = completionId;
        cellManager.addCell(
          'code',
          code,
          'assistant',
          cellManager.getCurrentAgentCell() || undefined,
          lastUserCellRef.current || undefined,
          undefined,
          actualCellId
        );
        console.log('[DEBUG] Added code cell:', actualCellId, 'with parent:', lastUserCellRef.current);
      }
      // Wait for next tick to ensure cell is properly set up
      await new Promise(resolve => setTimeout(resolve, 0));
      // set the active cell to the new code cell
      cellManager.setActiveCell(actualCellId);
      cellManager.setCurrentAgentCell(actualCellId);
      // Execute the code and collapse the cell
      const result = await cellManager.executeCell(actualCellId, true);
      cellManager.collapseCodeCell(actualCellId);
      return result;
    } catch (error) {
      console.error('[DEBUG] Fatal error in handleExecuteCode:', error);
      return `Fatal error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, [cellManager, lastUserCellRef]);

  // Main function for processing chat completions
  const processChatCompletion = useCallback(async ({
    messages,
    userCellId,
    skipMessageEntry = false,
    errorSource = 'chat'
  }: {
    messages: ChatMessage[],
    userCellId: string,
    skipMessageEntry?: boolean,
    errorSource?: 'chat' | 'regenerate'
  }) => {
    // Initialize thinkingCellId with empty string
    let thinkingCellId = '';

    try {
      setIsProcessingAgentResponse(true);
      
      // Set references to the current user cell
      lastUserCellRef.current = userCellId;
      cellManager.setActiveCell(userCellId);
      cellManager.setCurrentAgentCell(userCellId);

      // Add a thinking cell right after the user's message
      thinkingCellId = cellManager.addCell(
        'thinking',
        '🤔 Thinking...',
        'assistant',
        userCellId,
        userCellId
      );

      // Wait for next tick to ensure cell is rendered
      await new Promise(resolve => setTimeout(resolve, 0));

      // Scroll the thinking cell into view with a small delay
      cellManager.scrollCellIntoView(thinkingCellId, 100);

      // Create an abort controller for this chat completion
      const abortController = new AbortController();
      setActiveAbortController(abortController);

      // Use agent settings in chat completion
      const completion = chatCompletion({
        messages,
        model: agentSettings.model,
        temperature: agentSettings.temperature,
        maxSteps: 15,
        baseURL: agentSettings.baseURL,
        apiKey: agentSettings.apiKey,
        abortController,
        onExecuteCode: async (completionId: string, scriptContent: string) => {
          return await handleExecuteCode(completionId, scriptContent);
        },
        onMessage: (completionId: string, message: string, commitIds?: string[]) => {
          console.debug('[DEBUG] New Message:', completionId, message, commitIds);
          
          // First, create the markdown cell with the final response
          cellManager.updateCellById(
            completionId,
            message,
            'markdown',
            'assistant',
            lastUserCellRef.current || undefined
          );
          
          // Instead of deleting cells, mark them as staged or not staged (committed)
          if (lastUserCellRef.current) {
            // Get all child cells of the current user message
            const childrenIds = cellManager.getCellChildrenIds(lastUserCellRef.current);
            
            // For each child cell, update its status
            childrenIds.forEach(id => {
              // Skip the final response cell
              if (id === completionId) return;
              
              // Check if this is a committed cell
              const isCommitted = commitIds && commitIds.includes(id);
              
              // Update cell properties using setCells since CellManager may not have updateCellMetadata
              setCells(prev => prev.map(cell => {
                if (cell.id === id) {
                  return {
                    ...cell,
                    metadata: {
                      ...cell.metadata,
                      staged: !isCommitted, // Mark as staged if not committed
                      isCodeVisible: false, // Keep code collapsed for both staged and committed
                      isOutputVisible: isCommitted // Show output only for committed cells
                    }
                  };
                }
                return cell;
              }));
            });
          }
        },
        onStreaming: (completionId: string, message: string) => {
          // Update the thinking cell content while streaming
          cellManager.updateCellById(
            thinkingCellId,
            message,
            'thinking',
            'assistant',
            lastUserCellRef.current || undefined
          );
        }
      });

      // Process the completion stream
      for await (const item of completion) {
        console.debug('[DEBUG] New Response Item:', item);
        
        // Handle error responses from chatCompletion
        if (item.type === 'error') {
          const errorMessage = item.content || 'Unknown error occurred';
          console.error('[DEBUG] Error from chat completion service:', errorMessage);
          
          // Create an error message cell that replaces the thinking cell
          cellManager.updateCellById(
            thinkingCellId,
            `❌ **Error**: ${errorMessage}`,
            'markdown',
            'assistant',
            lastUserCellRef.current || undefined
          );
          
          // Display error to user
          setInitializationError(errorMessage);
          showToast(`Error: ${errorMessage}`, 'error');
          
          // We don't want to delete the thinking cell in the finally block
          // since we've just converted it to an error message
          thinkingCellId = '';
          
          // Exit the loop since we've encountered an error
          break;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[DEBUG] Error in ${errorSource} completion:`, error);
      
      // Set appropriate error message based on the source
      if (errorSource === 'regenerate') {
        setInitializationError(`Error regenerating response: ${errorMsg}. Please try again.`);
      } else {
        setInitializationError(`Error in chat completion: ${errorMsg}. Please try again.`);
      }
    } finally {
      setIsProcessingAgentResponse(false);
      setActiveAbortController(null);

      // Always remove the thinking cell if it exists
      if (thinkingCellId) {
        cellManager.deleteCell(thinkingCellId);
      }
      
      // Also clean up any other thinking cells that might be lingering
      setCells(prev => prev.filter(cell => cell.type !== 'thinking'));
    }
  }, [cellManager, executeCode, agentSettings, getConversationHistory, isReady, setCells]);

  // Handle regenerating responses
  const handleRegenerateClick = useCallback(async (cellId: string) => {
    if (!isReady || isProcessingAgentResponse) {
      console.log('[DEBUG] Cannot regenerate while processing another response or not ready',
        { isReady, isProcessingAgentResponse });
      return;
    }

    // Find the user message cell
    const userCell = cellManager.findCell(cell => cell.id === cellId);
    if (!userCell || userCell.role !== 'user') {
      console.error('[DEBUG] Cannot regenerate responses for a non-user cell or cell not found');
      return;
    }

    try {
      // Get the message content and position info before deletion
      const messageContent = userCell.content;

      // Find the cell's current index before deletion
      const currentIndex = cells.findIndex(cell => cell.id === cellId);

      // Delete the cell and its responses first
      cellManager.deleteCellWithChildren(cellId);

      // Wait a small tick to ensure deletion is complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Update references and process chat completion
      const messages = getConversationHistory(cellId);
      messages.push({
        role: 'user',
        content: messageContent,
      });
      // Add the new cell at the same position as the old one
      const newCellId = cellManager.addCell(
        'markdown',
        messageContent,
        'user',
        undefined,
        undefined,
        currentIndex
      );


      await processChatCompletion({
        messages,
        userCellId: newCellId,
        skipMessageEntry: true,
        errorSource: 'regenerate'
      });
    } catch (error) {
      console.error('[DEBUG] Error in regenerate:', error);
      setInitializationError(`Error regenerating response: ${error instanceof Error ? error.message : String(error)}. Please try again.`);
    }
  }, [isReady, isProcessingAgentResponse, getConversationHistory, processChatCompletion, cellManager, cells]);

  // Handle stopping chat completion
  const handleStopChatCompletion = useCallback(() => {
    if (activeAbortController) {
      console.log('Aborting active chat completion');
      activeAbortController.abort();
      setActiveAbortController(null);
      showToast('Stop request sent. The operation may take a moment to complete...', 'warning');
    }
  }, [activeAbortController]);

  // Handle sending chat messages
  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!isReady) {
      setInitializationError("AI assistant is not ready. Please wait.");
      return;
    }
    const activeCellId = cellManager.activeCellId;
    const messages = getConversationHistory(activeCellId || undefined);
    messages.push({
      role: 'user',
      content: message,
    });
    const userCellId = cellManager.addCell('markdown', message, 'user');

    await processChatCompletion({
      messages,
      userCellId,
      skipMessageEntry: false,
      errorSource: 'chat'
    });
  }, [isReady, cellManager, getConversationHistory, processChatCompletion]);

  return {
    isProcessingAgentResponse,
    initializationError,
    activeAbortController,
    handleSendChatMessage,
    handleRegenerateClick,
    handleStopChatCompletion,
    setInitializationError
  };
}
