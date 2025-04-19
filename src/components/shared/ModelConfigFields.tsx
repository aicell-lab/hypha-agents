import React from 'react';

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

export default ModelConfigFields; 