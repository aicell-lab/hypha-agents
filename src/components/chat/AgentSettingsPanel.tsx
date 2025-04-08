import React, { useState, useRef, useEffect } from 'react';
import { DefaultAgentConfig, AgentSettings } from '../../utils/chatCompletion';

// Add localStorage key constant
const AGENT_SETTINGS_STORAGE_KEY = 'agent_settings';

// Export helper functions for localStorage
export const loadSavedAgentSettings = (): AgentSettings => {
  try {
    const stored = localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY);
    if (!stored) return DefaultAgentConfig;
    return JSON.parse(stored) as AgentSettings;
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
    return DefaultAgentConfig;
  }
};

export const saveAgentSettings = (settings: AgentSettings): void => {
  try {
    localStorage.setItem(AGENT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
};

// Define interfaces for our settings

interface AgentSettingsProps {
  settings?: AgentSettings;
  onSettingsChange?: (settings: AgentSettings) => void;
  className?: string;
}


export const AgentSettingsPanel: React.FC<AgentSettingsProps> = ({ 
  settings,
  onSettingsChange = () => {},
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<AgentSettings>(settings || DefaultAgentConfig);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Update local settings when prop changes
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Save to localStorage first
      saveAgentSettings(localSettings);
      // Then notify parent component
      onSettingsChange(localSettings);
      // Close the panel
      setIsOpen(false);
      
      // Show success message
      const messageDiv = document.createElement('div');
      messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
      messageDiv.textContent = 'Settings saved successfully';
      document.body.appendChild(messageDiv);
      setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(messageDiv), 500);
      }, 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      
      // Show error message
      const messageDiv = document.createElement('div');
      messageDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
      messageDiv.textContent = 'Error saving settings';
      document.body.appendChild(messageDiv);
      setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(messageDiv), 500);
      }, 2000);
    }
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newSettings = {
      ...localSettings,
      [name]: name === 'temperature' ? parseFloat(value) : value
    };
    setLocalSettings(newSettings);
  };

  // Reset to defaults
  const handleReset = () => {
    const newSettings = { ...DefaultAgentConfig };
    setLocalSettings(newSettings);
    saveAgentSettings(newSettings);
    onSettingsChange(newSettings);
    
    // Show success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = 'Settings reset to defaults';
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Settings button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Agent Settings"
        aria-label="Configure agent settings"
      >
        <svg 
          className="w-5 h-5 text-gray-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Settings panel */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-[500px] bg-white rounded-lg shadow-xl z-[100] border border-gray-200">
          <form ref={formRef} onSubmit={handleSubmit} className="divide-y divide-gray-200">
            <div className="px-4 py-3 bg-gray-50 rounded-t-lg flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Agent Settings</h3>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Reset to defaults
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Model Settings Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Model Configuration</h4>
                
                <div className="space-y-2">
                  <label className="block text-sm text-gray-700">Base URL</label>
                  <div className="flex gap-2">
                    <select
                      name="baseURLPreset"
                      onChange={(e) => {
                        let value = e.target.value;
                        if (value === 'custom') {
                          // Keep current custom URL if switching to custom
                          return;
                        }
                        if(!value.endsWith('/')) {
                          value = value + '/';
                        }
                        // Update baseURL when selecting a preset
                        setLocalSettings({
                          ...localSettings,
                          baseURL: value
                        });
                      }}
                      value={[
                        'https://api.openai.com/v1/',
                        'http://localhost:11434/v1/',
                      ].includes(localSettings.baseURL) ? localSettings.baseURL : 'custom'}
                      className="w-1/3 px-3 py-2 border rounded-md text-sm"
                      title="Select API endpoint"
                      aria-label="Select API endpoint"
                    >
                      <option value="https://api.openai.com/v1">OpenAI</option>
                      <option value="http://localhost:11434/v1">Ollama</option>
                      <option value="custom">Custom</option>
                    </select>
                    <input
                      type="text"
                      name="baseURL"
                      value={localSettings.baseURL}
                      onChange={handleChange}
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
                    value={localSettings.apiKey}
                    onChange={handleChange}
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
                        'gpt-4',
                        'gpt-3.5-turbo',
                        'llama2',
                        'codellama',
                        'mistral',
                      ].includes(localSettings.model) ? localSettings.model : 'custom'}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'custom') {
                          // Keep current custom model if switching to custom
                          return;
                        }
                        // Update model when selecting a preset
                        setLocalSettings({
                          ...localSettings,
                          model: value
                        });
                      }}
                      className="w-1/3 px-3 py-2 border rounded-md text-sm"
                      title="Select AI model"
                      aria-label="Select AI model"
                    >
                      <option value="gpt-4">gpt-4</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                      <option value="llama2">llama2</option>
                      <option value="codellama">codellama</option>
                      <option value="mistral">mistral</option>
                      <option value="custom">Custom</option>
                    </select>
                    <input
                      type="text"
                      name="model"
                      value={localSettings.model}
                      onChange={handleChange}
                      className="flex-1 px-3 py-2 border rounded-md text-sm"
                      placeholder="Enter model ID"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm text-gray-700">
                    Temperature ({localSettings.temperature})
                  </label>
                  <input
                    type="range"
                    name="temperature"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localSettings.temperature}
                    onChange={handleChange}
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

              {/* Instructions Section */}
              <div className="space-y-2 pt-4">
                <h4 className="text-sm font-medium text-gray-900">Agent Instructions</h4>
                <textarea
                  name="instructions"
                  value={localSettings.instructions}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                  placeholder="Enter agent instructions..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 rounded-b-lg flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}; 