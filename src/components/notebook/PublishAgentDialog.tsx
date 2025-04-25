import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { NotebookCell, OutputItem, NotebookMetadata } from '../../types/notebook';
import ModelConfigForm from '../shared/ModelConfigForm';
import { AgentSettings, DefaultAgentConfig } from '../../utils/chatCompletion';

interface PublishAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agentData: PublishAgentData) => void;
  title: string;
  systemCell: NotebookCell | null;
  notebookTitle: string;
  existingId?: string;
  existingVersion?: string;
  welcomeMessage?: string;
  notebookMetadata?: NotebookMetadata;
}

export interface PublishAgentData {
  id?: string;
  name: string;
  description: string;
  version: string;
  license: string;
  welcomeMessage: string;
  modelConfig?: AgentSettings;
}

const PublishAgentDialog: React.FC<PublishAgentDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  systemCell,
  notebookTitle,
  existingId,
  existingVersion,
  welcomeMessage: defaultWelcomeMessage,
  notebookMetadata
}) => {
  const [id, setId] = useState(existingId || '');
  const [name, setName] = useState(notebookTitle || 'Untitled Agent');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState(existingVersion || '0.1.0');
  const [license, setLicense] = useState('CC-BY-4.0');
  const [welcomeMessage, setWelcomeMessage] = useState(defaultWelcomeMessage || 'Hi, how can I help you today?');
  const [isUpdatingExisting, setIsUpdatingExisting] = useState(!!existingId);
  const [modelConfig, setModelConfig] = useState<AgentSettings>(
    (notebookMetadata?.modelSettings as AgentSettings) || DefaultAgentConfig
  );
  
  // Reset the form when the dialog is opened with new values
  useEffect(() => {
    if (isOpen) {
      setId(existingId || '');
      setName(notebookTitle || 'Untitled Agent');
      setVersion(existingVersion || '0.1.0');
      setWelcomeMessage(defaultWelcomeMessage || 'Hi, how can I help you today?');
      setIsUpdatingExisting(!!existingId);
      // Use model settings from notebook metadata if available, otherwise use default
      setModelConfig(
        (notebookMetadata?.modelSettings as AgentSettings) || DefaultAgentConfig
      );
    }
  }, [isOpen, existingId, notebookTitle, existingVersion, defaultWelcomeMessage, notebookMetadata]);
  
  const handleSubmit = () => {
    onConfirm({
      id: isUpdatingExisting ? id.trim() : undefined, // Only include ID if updating existing agent
      name,
      description,
      version,
      license,
      welcomeMessage,
      modelConfig
    });
  };

  const handleCreateNew = () => {
    setId('');
    setIsUpdatingExisting(false);
  };

  // Format cell output for display
  const formatCellOutput = (cell: NotebookCell | null) => {
    if (!cell || !cell.output || cell.output.length === 0) {
      return 'No output available';
    }

    return cell.output.map((output: OutputItem, index: number) => {
      if (output.type === 'stream') {
        return (
          <pre key={index} className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
            {output.content || ''}
          </pre>
        );
      } else if (output.type === 'execute_result' || output.type === 'display_data') {
        if (output.attrs?.html) {
          return (
            <div 
              key={index} 
              className="text-xs max-h-40 overflow-auto" 
              dangerouslySetInnerHTML={{ __html: output.attrs.html as string }} 
            />
          );
        } else {
          return (
            <pre key={index} className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
              {output.content}
            </pre>
          );
        }
      }
      return null;
    });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full rounded bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
          <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
            {title}
            {isUpdatingExisting && <span className="ml-2 text-sm text-green-600 font-normal">(Update Existing Agent)</span>}
          </Dialog.Title>
          
          <div className="mb-6 space-y-4">
            {/* Optional ID Field */}
            <div>
              <label htmlFor="agent-id" className="block text-sm font-medium text-gray-700 mb-1">
                Agent ID <span className="text-gray-400 font-normal">(Optional - Leave empty for a new agent)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  id="agent-id"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter existing agent ID to update"
                  disabled={isUpdatingExisting}
                />
                {isUpdatingExisting && (
                  <button
                    onClick={handleCreateNew}
                    className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create New
                  </button>
                )}
              </div>
              {isUpdatingExisting && (
                <p className="mt-1 text-xs text-green-600">
                  This agent has already been published. Updates will create a new version.
                </p>
              )}
            </div>
            
            {/* Agent Name */}
            <div>
              <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 mb-1">
                Agent Name
              </label>
              <input
                type="text"
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter agent name"
                required
              />
            </div>
            
            {/* Agent Description */}
            <div>
              <label htmlFor="agent-description" className="block text-sm font-medium text-gray-700 mb-1">
                Agent Description
              </label>
              <textarea
                id="agent-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe what your agent does"
                required
              />
            </div>
            
            {/* Version and License in a flex row */}
            <div className="flex space-x-4">
              <div className="flex-1">
                <label htmlFor="agent-version" className="block text-sm font-medium text-gray-700 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  id="agent-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.1.0"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="agent-license" className="block text-sm font-medium text-gray-700 mb-1">
                  License
                </label>
                <select
                  id="agent-license"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="CC-BY-4.0">CC-BY-4.0</option>
                  <option value="CC-BY-SA-4.0">CC-BY-SA-4.0</option>
                  <option value="CC-BY-NC-4.0">CC-BY-NC-4.0</option>
                  <option value="MIT">MIT</option>
                  <option value="Apache-2.0">Apache-2.0</option>
                </select>
              </div>
            </div>
            
            {/* Welcome Message */}
            <div>
              <label htmlFor="welcome-message" className="block text-sm font-medium text-gray-700 mb-1">
                Welcome Message
              </label>
              <textarea
                id="welcome-message"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Welcome message when agent starts"
              />
            </div>
            
            {/* Model Configuration */}
            <div className="border-t pt-4">
              <ModelConfigForm
                settings={modelConfig}
                onSettingsChange={setModelConfig}
              />
            </div>
            
            {/* System Cell / Startup Script Preview */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Startup Script</h3>
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50 space-y-2">
                {systemCell ? (
                  <div>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-32 mt-1">
                      {systemCell.content}
                    </pre>
                    
                    <div className="text-xs font-semibold text-gray-700 mt-3">Startup Script Output:</div>
                    <div className="mt-1">
                      {formatCellOutput(systemCell)}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No startup script found</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                name.trim() 
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isUpdatingExisting ? 'Update Agent' : 'Publish Agent'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default PublishAgentDialog; 