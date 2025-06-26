import React, { useState, useEffect, useCallback } from 'react';

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
  lang: string;
  welcomeMessage: string;
  initialPrompt?: string;
  modelConfig: ModelConfig;
}

export interface AppFormData {
  name: string;
  description: string;
  version: string;
  license: string;
  lang: string;
  startupScript: string;
}

export interface BaseFormData {
  type: 'agent' | 'deno-app';
}

export type ConfigFormData = BaseFormData & (AgentFormData | AppFormData);

export const DefaultAgentFormData: AgentFormData = {
  name: '',
  description: '',
  version: '0.1.0',
  license: 'MIT',
  lang: 'python',
  welcomeMessage: 'Hello! How can I assist you today?',
  initialPrompt: '',
  modelConfig: DefaultModelConfig
};

export const DefaultAppFormData: AppFormData = {
  name: '',
  description: '',
  version: '0.1.0',
  license: 'MIT',
  lang: 'python',
  startupScript: ''
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



// Data structure for combined agent form data
export interface EditAgentFormData {
  agentId?: string;
  type: 'agent' | 'deno-app';
  // Agent-specific fields
  name: string;
  description: string;
  version: string;
  license: string;
  lang: string;
  // Agent-only fields
  welcomeMessage?: string;
  initialPrompt?: string;
  modelConfig?: ModelConfig;
  // App-only fields  
  startupScript?: string;
}

// Define a simple wrapper component for the canvas panel content
interface EditAgentCanvasContentProps {
  initialAgentData: Partial<EditAgentFormData>; // Use combined type
  systemCellContent?: string; // Add system cell content prop
  getLatestSystemCellContent?: () => string; // Add function to get latest content
  onSaveSettingsToNotebook: (data: EditAgentFormData) => void;
  onPublishAgent: (data: EditAgentFormData, isUpdating: boolean) => Promise<string | null>;
}

// Separate form component for Agent configuration
interface AgentFormComponentProps {
  initialData: Partial<EditAgentFormData>;
  systemCellContent: string;
  getLatestSystemCellContent?: () => string;
  onFormChange: (data: EditAgentFormData) => void;
}

const AgentFormComponent: React.FC<AgentFormComponentProps> = ({
  initialData,
  systemCellContent,
  getLatestSystemCellContent,
  onFormChange
}) => {
  const [formData, setFormData] = useState<AgentFormData>(() => ({
    ...DefaultAgentFormData,
    name: initialData.name || '',
    description: initialData.description || '',
    version: initialData.version || '0.1.0',
    license: initialData.license || 'CC-BY-4.0',
    lang: initialData.lang || 'python',
    welcomeMessage: initialData.welcomeMessage || 'Hi, how can I help you today?',
    initialPrompt: initialData.initialPrompt || systemCellContent
  }));

  // Update parent when form data changes - memoize the callback data
  useEffect(() => {
    const combinedData: EditAgentFormData = {
      agentId: initialData.agentId,
      type: 'agent',
      name: formData.name,
      description: formData.description,
      version: formData.version,
      license: formData.license,
      lang: formData.lang,
      welcomeMessage: formData.welcomeMessage,
      initialPrompt: formData.initialPrompt,
      modelConfig: formData.modelConfig
    };
    onFormChange(combinedData);
  }, [
    formData.name,
    formData.description,
    formData.version,
    formData.license,
    formData.lang,
    formData.welcomeMessage,
    formData.initialPrompt,
    formData.modelConfig,
    initialData.agentId,
    onFormChange
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleModelConfigChange = (fieldName: keyof ModelConfig, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      modelConfig: {
        ...prev.modelConfig,
        [fieldName]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Agent Basic Information */}
      <div className="space-y-4">
        <div>
          <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            id="agent-name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Give your agent a name"
            required
          />
        </div>

        <div>
          <label htmlFor="agent-description" className="block text-sm font-medium text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            id="agent-description"
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="What does this agent do?"
            required
          />
        </div>

        <div>
          <label htmlFor="agent-license" className="block text-sm font-medium text-gray-700">
            License
          </label>
          <select
            name="license"
            id="agent-license"
            value={formData.license}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            {licenses.map((license) => (
              <option key={license.value} value={license.value}>{license.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="agent-lang" className="block text-sm font-medium text-gray-700">
            Language
          </label>
          <select
            name="lang"
            id="agent-lang"
            value={formData.lang}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>

        <div>
          <label htmlFor="agent-welcomeMessage" className="block text-sm font-medium text-gray-700">
            Welcome Message
          </label>
          <textarea
            name="welcomeMessage"
            id="agent-welcomeMessage"
            rows={2}
            value={formData.welcomeMessage}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Message to display when a user starts chatting with your agent"
          />
        </div>

        <div>
          <label htmlFor="agent-initialPrompt" className="block text-sm font-medium text-gray-700">
            System Configuration
            <span className="text-gray-400 font-normal"> (From the first system cell in the current chat)</span>
          </label>
          <div className="flex gap-2">
            <textarea
              name="initialPrompt"
              id="agent-initialPrompt"
              rows={10}
              value={formData.initialPrompt}
              readOnly
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Optional: Provide instructions that define the agent's behavior and capabilities"
            />
            <button
              type="button"
              onClick={() => {
                const latestContent = getLatestSystemCellContent?.() || systemCellContent;
                setFormData(prev => ({
                  ...prev,
                  initialPrompt: latestContent
                }));
              }}
              className="mt-1 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0 h-fit"
              title="Refresh from system cell"
            >
              ↻
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Separate form component for App configuration
interface AppFormComponentProps {
  initialData: Partial<EditAgentFormData>;
  systemCellContent: string;
  getLatestSystemCellContent?: () => string;
  onFormChange: (data: EditAgentFormData) => void;
}

const AppFormComponent: React.FC<AppFormComponentProps> = ({
  initialData,
  systemCellContent,
  getLatestSystemCellContent,
  onFormChange
}) => {
  const [formData, setFormData] = useState<AppFormData>(() => ({
    ...DefaultAppFormData,
    name: initialData.name || '',
    description: initialData.description || '',
    version: initialData.version || '0.1.0',
    license: initialData.license || 'MIT',
    lang: initialData.lang || 'python',
    startupScript: initialData.startupScript || systemCellContent
  }));

  // Update parent when form data changes - memoize the callback data
  useEffect(() => {
    const combinedData: EditAgentFormData = {
      agentId: initialData.agentId,
      type: 'deno-app',
      name: formData.name,
      description: formData.description,
      version: formData.version,
      license: formData.license,
      lang: formData.lang,
      startupScript: formData.startupScript
    };
    onFormChange(combinedData);
  }, [
    formData.name,
    formData.description,
    formData.version,
    formData.license,
    formData.lang,
    formData.startupScript,
    initialData.agentId,
    onFormChange
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-6">
      {/* App Basic Information */}
      <div className="space-y-4">
        <div>
          <label htmlFor="app-name" className="block text-sm font-medium text-gray-700">
            App Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            id="app-name"
            value={formData.name}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Give your Deno app a name"
            required
          />
        </div>

        <div>
          <label htmlFor="app-description" className="block text-sm font-medium text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            id="app-description"
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="What does this Deno app do?"
            required
          />
        </div>

        <div>
          <label htmlFor="app-license" className="block text-sm font-medium text-gray-700">
            License
          </label>
          <select
            name="license"
            id="app-license"
            value={formData.license}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            {licenses.map((license) => (
              <option key={license.value} value={license.value}>{license.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="app-lang" className="block text-sm font-medium text-gray-700">
            Language
          </label>
          <select
            name="lang"
            id="app-lang"
            value={formData.lang}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>

        <div>
          <label htmlFor="app-startupScript" className="block text-sm font-medium text-gray-700">
            Startup Script <span className="text-red-500">*</span>
            <span className="text-gray-400 font-normal"> (From the first system cell in the current chat)</span>
          </label>
          <div className="flex gap-2">
            <textarea
              name="startupScript"
              id="app-startupScript"
              rows={15}
              value={formData.startupScript}
              readOnly
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder=""
              required
            />
            <button
              type="button"
              onClick={() => {
                const latestContent = getLatestSystemCellContent?.() || systemCellContent;
                setFormData(prev => ({
                  ...prev,
                  startupScript: latestContent
                }));
              }}
              className="mt-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0 h-fit"
              title="Refresh from system cell"
            >
              ↻
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditAgentCanvasContent: React.FC<EditAgentCanvasContentProps> = ({
  initialAgentData,
  systemCellContent = '',
  getLatestSystemCellContent,
  onSaveSettingsToNotebook,
  onPublishAgent
}) => {
  // State for all form fields including ID and type selection
  const [agentId, setAgentId] = useState(initialAgentData.agentId || '');
  const [isUpdatingExisting, setIsUpdatingExisting] = useState(!!initialAgentData.agentId);
  const [selectedType, setSelectedType] = useState<'agent' | 'deno-app'>(
    initialAgentData.type || 'agent'
  );
  const [currentFormData, setCurrentFormData] = useState<EditAgentFormData>(() => ({
    agentId: initialAgentData.agentId,
    type: initialAgentData.type || 'agent',
    name: initialAgentData.name || '',
    description: initialAgentData.description || '',
    version: initialAgentData.version || '0.1.0',
    license: initialAgentData.license || (initialAgentData.type === 'deno-app' ? 'MIT' : 'CC-BY-4.0'),
    lang: initialAgentData.lang || 'python',
    welcomeMessage: initialAgentData.welcomeMessage,
    initialPrompt: initialAgentData.initialPrompt,
    modelConfig: initialAgentData.modelConfig,
    startupScript: initialAgentData.startupScript
  }));

  // Update local state when initial props change
  useEffect(() => {
    console.log('EditAgentCanvasContent: initialAgentData changed', initialAgentData);
    setAgentId(initialAgentData.agentId || '');
    setIsUpdatingExisting(!!initialAgentData.agentId);
    setSelectedType(initialAgentData.type || 'agent');
    setCurrentFormData({
      agentId: initialAgentData.agentId,
      type: initialAgentData.type || 'agent',
      name: initialAgentData.name || '',
      description: initialAgentData.description || '',
      version: initialAgentData.version || '0.1.0',
      license: initialAgentData.license || (initialAgentData.type === 'deno-app' ? 'MIT' : 'CC-BY-4.0'),
      lang: initialAgentData.lang || 'python',
      welcomeMessage: initialAgentData.welcomeMessage,
      initialPrompt: initialAgentData.initialPrompt,
      modelConfig: initialAgentData.modelConfig,
      startupScript: initialAgentData.startupScript
    });
  }, [initialAgentData, systemCellContent]);

  const handleFormChange = useCallback((newFormData: EditAgentFormData) => {
    setCurrentFormData(newFormData);
  }, []);

  const handleTypeChange = (newType: 'agent' | 'deno-app') => {
    setSelectedType(newType);
    // Reset form data when type changes to get proper defaults
    setCurrentFormData({
      agentId: agentId,
      type: newType,
      name: '',
      description: '',
      version: '0.1.0',
      license: newType === 'deno-app' ? 'MIT' : 'CC-BY-4.0',
      lang: 'python',
      // Type-specific fields will be set by the individual form components
    });
  };

  const handleCreateNew = () => {
    setAgentId('');
    setIsUpdatingExisting(false);
  };

  const handleSave = () => {
    const dataToSave = {
      ...currentFormData,
      agentId: agentId.trim() || undefined
    };
    onSaveSettingsToNotebook(dataToSave);

    // Show success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = `${selectedType === 'agent' ? 'Agent' : 'App'} settings saved to notebook`;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  const handlePublish = async () => {
    // Refresh content from system cell before publishing
    const latestSystemContent = getLatestSystemCellContent?.() || systemCellContent;
    
    // Update the current form data with latest system content
    const updatedFormData = {
      ...currentFormData,
      agentId: agentId.trim() || undefined
    };
    
    // Update the appropriate field based on type
    if (selectedType === 'agent') {
      updatedFormData.initialPrompt = latestSystemContent;
    } else {
      updatedFormData.startupScript = latestSystemContent;
    }
    
    const newAgentId = await onPublishAgent(updatedFormData, isUpdatingExisting);

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
        <h2 className="text-xl font-semibold mb-4">
          Edit {selectedType === 'agent' ? 'Agent' : 'Deno App'} Configuration
        </h2>

        {/* Type Selection */}
        <div>
          <label htmlFor="type-select" className="block text-sm font-medium text-gray-700 mb-2">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            id="type-select"
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value as 'agent' | 'deno-app')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="agent">AI Agent</option>
            <option value="deno-app">Deno Application</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            {selectedType === 'agent' 
              ? 'An AI agent that can chat and execute code to help users'
              : 'A Deno/TypeScript application that runs continuously in the background'
            }
          </p>
        </div>

        {/* Agent ID Field */}
        <div>
          <label htmlFor="agent-id" className="block text-sm font-medium text-gray-700 mb-1">
            {selectedType === 'agent' ? 'Agent' : 'App'} ID{' '}
            <span className="text-gray-400 font-normal">
              (Optional - Leave empty to publish as new {selectedType === 'agent' ? 'agent' : 'app'})
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              id="agent-id"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder={`Enter existing ${selectedType === 'agent' ? 'agent' : 'app'} ID to update`}
              disabled={isUpdatingExisting}
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
              Publishing will update {selectedType === 'agent' ? 'Agent' : 'App'} ID: {agentId}
            </p>
          )}
        </div>

        {/* Dynamic Form based on selected type */}
        {selectedType === 'agent' ? (
          <AgentFormComponent
            initialData={currentFormData}
            systemCellContent={systemCellContent}
            getLatestSystemCellContent={getLatestSystemCellContent}
            onFormChange={handleFormChange}
          />
        ) : (
          <AppFormComponent
            initialData={currentFormData}
            systemCellContent={systemCellContent}
            getLatestSystemCellContent={getLatestSystemCellContent}
            onFormChange={handleFormChange}
          />
        )}
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
          disabled={!currentFormData.name?.trim()}
          className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            currentFormData.name?.trim()
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isUpdatingExisting 
            ? `Update & Publish ${selectedType === 'agent' ? 'Agent' : 'App'}` 
            : `Publish New ${selectedType === 'agent' ? 'Agent' : 'App'}`}
        </button>
      </div>
    </div>
  );
};

export default EditAgentCanvasContent;
