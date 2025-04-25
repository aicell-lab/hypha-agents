import React, { useState, useEffect } from 'react';

export interface ModelConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export const DefaultModelConfig: ModelConfig = {
  baseURL: 'https://api.openai.com/v1/',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 1.0
};

interface ModelConfigFieldsProps {
  config: ModelConfig;
  onConfigChange: (fieldName: keyof ModelConfig, value: string | number) => void;
}

const ModelConfigFields: React.FC<ModelConfigFieldsProps> = ({
  config,
  onConfigChange
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900">Model Configuration</h4>
      
      <div className="space-y-2">
        <label className="block text-sm text-gray-700">Base URL</label>
        <div className="flex gap-2">
          <select
            name="baseURLPreset"
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'custom') {
                return;
              }
              onConfigChange('baseURL', value.endsWith('/') ? value : value + '/');
            }}
            value={[
              'https://api.openai.com/v1/',
              'http://localhost:11434/v1/',
            ].includes(config.baseURL) ? config.baseURL : 'custom'}
            className="w-1/3 px-3 py-2 border rounded-md text-sm"
            title="Select API endpoint"
            aria-label="Select API endpoint"
          >
            <option value="https://api.openai.com/v1/">OpenAI</option>
            <option value="http://localhost:11434/v1/">Ollama</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="text"
            name="baseURL"
            value={config.baseURL}
            onChange={(e) => onConfigChange('baseURL', e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md text-sm"
            placeholder="Enter API base URL"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-700">API Key</label>
        <input
          type="password"
          name="apiKey"
          value={config.apiKey}
          onChange={(e) => onConfigChange('apiKey', e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
          placeholder="Enter API key"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-700">Model</label>
        <div className="flex gap-2">
          <select
            name="model"
            value={[
              'o3-mini',
              'gpt-4o',
              'gpt-4o-mini',
              'llama3.1',
              'qwen2.5-coder',
              'codellama',
              'mistral',
            ].includes(config.model) ? config.model : 'custom'}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'custom') {
                // Keep current custom model if switching to custom
                return;
              }
              // Update model when selecting a preset
              onConfigChange('model', value);
            }}
            className="w-1/3 px-3 py-2 border rounded-md text-sm"
            title="Select AI model"
            aria-label="Select AI model"
          >
            <option value="o3-mini">o3-mini</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="llama3.1">llama3.1</option>
            <option value="qwen2.5-coder">qwen2.5-coder</option>
            <option value="codellama">codellama</option>
            <option value="mistral">mistral</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="text"
            name="model"
            value={config.model}
            onChange={(e) => onConfigChange('model', e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md text-sm"
            placeholder="Enter model ID"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-700">
          Temperature ({config.temperature})
        </label>
        <input
          type="range"
          name="temperature"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature}
          onChange={(e) => onConfigChange('temperature', parseFloat(e.target.value))}
          className="w-full"
          title="Adjust temperature"
          aria-label="Adjust temperature"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Precise (0)</span>
          <span>Balanced (1)</span>
          <span>Creative (2)</span>
        </div>
      </div>
    </div>
  );
};
export interface AgentFormData {
  name: string;
  description: string;
  version: string;
  license: string;
  welcomeMessage: string;
  initialPrompt?: string;
  modelConfig: ModelConfig;
}

export const DefaultAgentFormData: AgentFormData = {
  name: '',
  description: '',
  version: '0.1.0',
  license: 'MIT',
  welcomeMessage: 'Hello! How can I assist you today?',
  initialPrompt: '',
  modelConfig: DefaultModelConfig
};

export const licenses = [
  { value: 'MIT', label: 'MIT License' },
  { value: 'Apache-2.0', label: 'Apache License 2.0' },
  { value: 'GPL-3.0', label: 'GNU General Public License v3.0' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause License' },
  { value: 'CC-BY-4.0', label: 'Creative Commons Attribution 4.0' },
  { value: 'CC-BY-SA-4.0', label: 'Creative Commons Attribution-ShareAlike 4.0' },
  { value: 'CC0-1.0', label: 'Creative Commons Zero v1.0 Universal' },
  { value: 'UNLICENSED', label: 'Unlicensed / Proprietary' },
];

interface AgentConfigFormProps {
  formData: AgentFormData;
  onFormChange: (newFormData: AgentFormData) => void;
  showModelConfig?: boolean;
}

const AgentConfigForm: React.FC<AgentConfigFormProps> = ({
  formData,
  onFormChange,
  showModelConfig = true
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFormChange({
      ...formData,
      [name]: value
    });
  };

  const handleModelConfigChange = (fieldName: keyof ModelConfig, value: string | number) => {
    onFormChange({
      ...formData,
      modelConfig: {
        ...formData.modelConfig,
        [fieldName]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Agent Basic Information */}
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            id="name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Give your agent a name"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            id="description"
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="What does this agent do?"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="version" className="block text-sm font-medium text-gray-700">
              Version
            </label>
            <input
              type="text"
              name="version"
              id="version"
              value={formData.version}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="e.g., 0.1.0"
            />
          </div>

          <div>
            <label htmlFor="license" className="block text-sm font-medium text-gray-700">
              License
            </label>
            <select
              name="license"
              id="license"
              value={formData.license}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {licenses.map((license) => (
                <option key={license.value} value={license.value}>{license.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-700">
            Welcome Message
          </label>
          <textarea
            name="welcomeMessage"
            id="welcomeMessage"
            rows={2}
            value={formData.welcomeMessage}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Message to display when a user starts chatting with your agent"
          />
        </div>

        <div>
          <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700">
          System Configuration (From the first system cell in the current chat)
          </label>
          <textarea
            name="initialPrompt"
            id="initialPrompt"
            rows={10}
            value={formData.initialPrompt}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Optional: Provide instructions that define the agent's behavior and capabilities"
          />
        </div>
      </div>

      {/* Model Configuration */}
      {showModelConfig && (
        <div className="border-t pt-4">
          <ModelConfigFields
            config={formData.modelConfig}
            onConfigChange={handleModelConfigChange}
          />
        </div>
      )}
    </div>
  );
};

// Data structure for combined agent form data
export interface EditAgentFormData extends AgentFormData {
  agentId?: string;
}

// Define a simple wrapper component for the canvas panel content
interface EditAgentCanvasContentProps {
  initialAgentData: Partial<EditAgentFormData>; // Use combined type
  onSaveSettingsToNotebook: (data: EditAgentFormData) => void;
  onPublishAgent: (data: EditAgentFormData, isUpdating: boolean) => Promise<string | null>;
}

const EditAgentCanvasContent: React.FC<EditAgentCanvasContentProps> = ({
  initialAgentData,
  onSaveSettingsToNotebook,
  onPublishAgent
}) => {
  // State for all form fields including ID and model config
  const [agentId, setAgentId] = useState(initialAgentData.agentId || '');
  const [isUpdatingExisting, setIsUpdatingExisting] = useState(!!initialAgentData.agentId);
  const [agentData, setAgentData] = useState<AgentFormData>(() => ({
    ...DefaultAgentFormData,
    name: initialAgentData.name || '',
    description: initialAgentData.description || '',
    version: initialAgentData.version || '0.1.0',
    license: initialAgentData.license || 'CC-BY-4.0',
    welcomeMessage: initialAgentData.welcomeMessage || 'Hi, how can I help you today?',
    initialPrompt: initialAgentData.initialPrompt || ''
  }));

  // Update local state when initial props change (e.g., notebook metadata updates)
  useEffect(() => {
    console.log('EditAgentCanvasContent: initialAgentData changed', initialAgentData);
    setAgentId(initialAgentData.agentId || '');
    setIsUpdatingExisting(!!initialAgentData.agentId);
    setAgentData({
      ...DefaultAgentFormData,
      name: initialAgentData.name || '',
      description: initialAgentData.description || '',
      version: initialAgentData.version || '0.1.0',
      license: initialAgentData.license || 'CC-BY-4.0',
      welcomeMessage: initialAgentData.welcomeMessage || 'Hi, how can I help you today?',
      initialPrompt: initialAgentData.initialPrompt || ''
    });
  }, [initialAgentData]); // This will update when notebook metadata changes

  const handleAgentFormChange = (updatedData: AgentFormData) => {
    setAgentData(updatedData);
  };

  const handleCreateNew = () => {
    setAgentId('');
    setIsUpdatingExisting(false);
  };

  const handleSave = () => {
    const combinedData: EditAgentFormData = {
      ...agentData,
      agentId: agentId.trim() || undefined // Only include ID if it has value
    };
    onSaveSettingsToNotebook(combinedData);

    // Show success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = 'Agent settings saved to notebook';
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  const handlePublish = async () => {
    const combinedData: EditAgentFormData = {
      ...agentData,
      agentId: agentId.trim() || undefined // Only include ID if it has value
    };
    const newAgentId = await onPublishAgent(combinedData, isUpdatingExisting);

    if (newAgentId) {
      setAgentId(newAgentId);
      setIsUpdatingExisting(true);
    }
  };

  return (
    // Use flex layout to make buttons stick to bottom
    <div className="flex flex-col h-full">
      {/* Scrollable form content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <h2 className="text-xl font-semibold mb-4">Edit Agent Configuration</h2>

        {/* Agent ID Field (similar to PublishAgentDialog) */}
        <div>
          <label htmlFor="agent-id" className="block text-sm font-medium text-gray-700 mb-1">
            Agent ID <span className="text-gray-400 font-normal">(Optional - Leave empty to publish as new agent)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              id="agent-id"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter existing agent ID to update"
              disabled={isUpdatingExisting} // Disable if updating
            />
            {isUpdatingExisting && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0"
              >
                Publish New
              </button>
            )}
          </div>
          {isUpdatingExisting && (
            <p className="mt-1 text-xs text-green-600">
              Publishing will update Agent ID: {agentId}
            </p>
          )}
        </div>

        {/* Existing AgentConfigForm */}
        <AgentConfigForm
          formData={agentData}
          onFormChange={handleAgentFormChange}
          showModelConfig={false}
        />
        {/* Model settings are now handled in a separate canvas window */}
      </div>

      {/* Fixed bottom button area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 flex justify-end gap-3 sticky bottom-0">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Settings to Notebook
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={!agentData.name.trim()} // Example disable condition
          className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            agentData.name.trim()
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isUpdatingExisting ? 'Update & Publish Agent' : 'Publish New Agent'}
        </button>
      </div>
    </div>
  );
};

export default EditAgentCanvasContent;
