import React, { useState, useMemo } from 'react';
import { FaTimes, FaFolder, FaCog, FaPlus, FaTrash, FaServer, FaDownload, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { showToast } from '../../utils/notebookUtils';

export interface MountedDirectory {
  name: string;
  mountPoint: string;
  timestamp: string;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
}

export interface HyphaService {
  id: string;
  name: string;
  description: string;
  serviceUrl: string;
  // Functions/methods available in this service
  functions?: Array<{
    name: string;
    description: string;
    parameters?: any;
  }>;
  // Full service schema (for generating system prompts)
  schema?: any;
}

interface EnvironmentInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mountedDirectories: MountedDirectory[];
  environmentVariables: EnvironmentVariable[];
  onAddEnvVar: (key: string, value: string) => void;
  onRemoveEnvVar: (key: string) => void;
  installedServices: HyphaService[];
  onAddService: (serviceUrl: string) => Promise<void>;
  onRemoveService: (serviceId: string) => void;
  environmentPrompt: string; // Generated environment prompt from the hook
}

const EnvironmentInfoDialog: React.FC<EnvironmentInfoDialogProps> = ({
  isOpen,
  onClose,
  mountedDirectories,
  environmentVariables,
  onAddEnvVar,
  onRemoveEnvVar,
  installedServices,
  onAddService,
  onRemoveService,
  environmentPrompt, // Use the prompt from the hook
}) => {
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newServiceUrl, setNewServiceUrl] = useState('');
  const [isAddingService, setIsAddingService] = useState(false);
  const [activeTab, setActiveTab] = useState<'mounted' | 'env' | 'services' | 'prompt'>('mounted');
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  const handleAddEnvVar = () => {
    if (newEnvKey.trim() && newEnvValue.trim()) {
      onAddEnvVar(newEnvKey.trim(), newEnvValue.trim());
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const handleAddService = async () => {
    if (newServiceUrl.trim()) {
      setIsAddingService(true);
      try {
        await onAddService(newServiceUrl.trim());
        setNewServiceUrl('');
        showToast('Hypha service installed successfully', 'success');
      } catch (error) {
        console.error('Error adding service:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to install service';
        showToast(errorMsg, 'error');
      } finally {
        setIsAddingService(false);
      }
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(environmentPrompt);
  };

  const toggleServiceExpanded = (serviceId: string) => {
    setExpandedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FaCog className="text-blue-600" />
            <h2 className="text-xl font-semibold">Environment Information</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Close"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'mounted'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('mounted')}
          >
            <div className="flex items-center gap-2">
              <FaFolder />
              <span>Mounted Directories</span>
            </div>
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'env'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('env')}
          >
            <div className="flex items-center gap-2">
              <FaCog />
              <span>Environment Variables</span>
            </div>
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'services'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('services')}
          >
            <div className="flex items-center gap-2">
              <FaServer />
              <span>Hypha Services</span>
            </div>
          </button>
          <button
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'prompt'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('prompt')}
          >
            <div className="flex items-center gap-2">
              <FaDownload />
              <span>Generated Prompt</span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Mounted Directories Tab */}
          {activeTab === 'mounted' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Local directories that have been mounted to the Python environment and are accessible for file operations.
              </p>
              {mountedDirectories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaFolder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No directories mounted</p>
                  <p className="text-sm mt-1">Use the "Mount Directory" option in the toolbar to add directories</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {mountedDirectories.map((dir, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FaFolder className="text-blue-600" />
                        <div>
                          <div className="font-medium">{dir.name}</div>
                          <div className="text-sm text-gray-600">Mount point: {dir.mountPoint}</div>
                          <div className="text-xs text-gray-500">Mounted: {new Date(dir.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Environment Variables Tab */}
          {activeTab === 'env' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Configure environment variables that will be available in the Python environment.
              </p>

              {/* Add new env var */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Add Environment Variable</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Variable name (e.g., API_KEY)"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEnvVar()}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddEnvVar()}
                  />
                  <button
                    onClick={handleAddEnvVar}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>

              {/* List of env vars */}
              {environmentVariables.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaCog className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No environment variables configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {environmentVariables.map((env, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium font-mono text-sm">{env.key}</div>
                        <div className="text-sm text-gray-600 font-mono">{env.value}</div>
                      </div>
                      <button
                        onClick={() => onRemoveEnvVar(env.key)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hypha Services Tab */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Install Hypha services to extend the capabilities available in your Python environment.
              </p>

              {/* Add new service */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Install Hypha Service</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Hypha service URL (e.g., https://hypha.aicell.io/workspace/service-id)"
                    value={newServiceUrl}
                    onChange={(e) => setNewServiceUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddService()}
                  />
                  <button
                    onClick={handleAddService}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    disabled={!newServiceUrl.trim() || isAddingService}
                  >
                    {isAddingService ? 'Adding...' : <FaPlus />}
                  </button>
                </div>
              </div>

              {/* List of services */}
              {installedServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaServer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No services installed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {installedServices.map((service) => (
                    <div key={service.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-lg">{service.name}</div>
                          <div className="text-sm text-gray-600 mt-1">{service.description}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{service.serviceUrl}</div>
                        </div>
                        <button
                          onClick={() => onRemoveService(service.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove service"
                        >
                          <FaTrash />
                        </button>
                      </div>

                      {service.functions && service.functions.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <button
                            onClick={() => toggleServiceExpanded(service.id)}
                            className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-blue-600 transition-colors w-full"
                          >
                            {expandedServices[service.id] ? (
                              <FaChevronDown className="w-3 h-3" />
                            ) : (
                              <FaChevronRight className="w-3 h-3" />
                            )}
                            <span>Available Functions ({service.functions.length})</span>
                          </button>
                          {expandedServices[service.id] && (
                            <div className="space-y-3">
                              {service.functions.map((func, idx) => (
                                <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                                  <div className="font-mono text-blue-600 font-medium mb-1">
                                    {func.name}()
                                  </div>
                                  {func.description && (
                                    <div className="text-sm text-gray-600 mb-2">{func.description}</div>
                                  )}
                                  {func.parameters && func.parameters.properties && (
                                    <div className="mt-2">
                                      <div className="text-xs font-medium text-gray-500 mb-1">Parameters:</div>
                                      <div className="space-y-1">
                                        {Object.entries(func.parameters.properties).map(([paramName, paramInfo]: [string, any]) => (
                                          <div key={paramName} className="text-xs pl-3">
                                            <span className="font-mono text-purple-600">{paramName}</span>
                                            {paramInfo.type && (
                                              <span className="text-gray-500"> ({paramInfo.type})</span>
                                            )}
                                            {func.parameters.required?.includes(paramName) && (
                                              <span className="text-red-500 ml-1">*</span>
                                            )}
                                            {paramInfo.description && (
                                              <div className="text-gray-600 ml-4 mt-0.5">
                                                {paramInfo.description}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                      {func.parameters.required && func.parameters.required.length > 0 && (
                                        <div className="text-xs text-gray-500 mt-2">
                                          <span className="text-red-500">*</span> Required parameters
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generated Prompt Tab */}
          {activeTab === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  This is the complete environment prompt that will be included in the AI assistant's context.
                </p>
                <button
                  onClick={handleCopyPrompt}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border">
                <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                  {environmentPrompt}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentInfoDialog;
