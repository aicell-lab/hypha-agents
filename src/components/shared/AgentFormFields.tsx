import React from 'react';

export interface AgentFormData {
  name: string;
  description: string;
  version: string;
  license: string;
  welcomeMessage: string;
  initialPrompt?: string;
}

export const licenses = [
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-4.0',
  'MIT',
  'Apache-2.0'
];

interface AgentFormFieldsProps {
  formData: AgentFormData;
  onFormChange: (fieldName: keyof AgentFormData, value: string) => void;
  showSystemPrompt?: boolean;
}

const AgentFormFields: React.FC<AgentFormFieldsProps> = ({
  formData,
  onFormChange,
  showSystemPrompt = true
}) => {
  return (
    <div className="space-y-4">
      {/* Agent Name */}
      <div>
        <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 mb-1">
          Agent Name
        </label>
        <input
          type="text"
          id="agent-name"
          value={formData.name}
          onChange={(e) => onFormChange('name', e.target.value)}
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
          value={formData.description}
          onChange={(e) => onFormChange('description', e.target.value)}
          rows={2}
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
            value={formData.version}
            onChange={(e) => onFormChange('version', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="1.0.0"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="agent-license" className="block text-sm font-medium text-gray-700 mb-1">
            License
          </label>
          <select
            id="agent-license"
            value={formData.license}
            onChange={(e) => onFormChange('license', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {licenses.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
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
          value={formData.welcomeMessage}
          onChange={(e) => onFormChange('welcomeMessage', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Welcome message when agent starts"
        />
      </div>
      
      {/* Initial System Prompt */}
      {showSystemPrompt && (
        <div>
          <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700 mb-1">
            Initial System Prompt
            <span className="ml-2 text-xs text-gray-500">
              (This is the instruction your agent will follow)
            </span>
          </label>
          <textarea
            id="initialPrompt"
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={formData.initialPrompt || ''}
            onChange={(e) => onFormChange('initialPrompt', e.target.value)}
            placeholder="Enter instructions for your agent..."
          />
        </div>
      )}
    </div>
  );
};

export default AgentFormFields; 