import React from 'react';
import ModelConfigFields, { ModelConfig, DefaultModelConfig } from './ModelConfigFields';

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
              placeholder="e.g., 1.0.0"
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
            Initial System Prompt
          </label>
          <textarea
            name="initialPrompt"
            id="initialPrompt"
            rows={4}
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

export default AgentConfigForm; 