import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DefaultAgentConfig, AgentSettings } from '../../utils/chatCompletion';

// Add localStorage key constants
const AGENT_SETTINGS_STORAGE_KEY = 'agent_settings';
const AGENT_PRESETS_STORAGE_KEY = 'agent_presets';

// Define preset interface
interface AgentPreset extends AgentSettings {
  name: string;
  description?: string;
}

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

// Add preset management functions
export const loadSavedPresets = (): AgentPreset[] => {
  try {
    const stored = localStorage.getItem(AGENT_PRESETS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as AgentPreset[];
  } catch (error) {
    console.error('Error loading presets from localStorage:', error);
    return [];
  }
};

export const savePreset = (preset: AgentPreset): void => {
  try {
    const presets = loadSavedPresets();
    const existingIndex = presets.findIndex(p => p.name === preset.name);
    
    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }
    
    localStorage.setItem(AGENT_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Error saving preset to localStorage:', error);
  }
};

export const deletePreset = (presetName: string): void => {
  try {
    const presets = loadSavedPresets();
    const filteredPresets = presets.filter(p => p.name !== presetName);
    localStorage.setItem(AGENT_PRESETS_STORAGE_KEY, JSON.stringify(filteredPresets));
  } catch (error) {
    console.error('Error deleting preset from localStorage:', error);
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
  const [presets, setPresets] = useState<AgentPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Get button position for desktop dropdown positioning
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonPosition, setButtonPosition] = useState<{ top: number; right: number } | null>(null);

  // Load presets on mount
  useEffect(() => {
    setPresets(loadSavedPresets());
  }, []);

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

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonPosition({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right
      });
    }
  }, [isOpen]);

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

  // Handle saving preset
  const handleSavePreset = () => {
    const name = prompt('Enter preset name:');
    if (!name) return;
    
    const preset: AgentPreset = {
      ...localSettings,
      name,
    };
    
    savePreset(preset);
    setPresets(loadSavedPresets());

    // Show success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = 'Preset saved successfully';
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  // Handle loading preset
  const handleLoadPreset = (preset: AgentPreset) => {
    const { name, description, ...settings } = preset;
    setLocalSettings(settings);
    saveAgentSettings(settings);
    onSettingsChange(settings);

    // Show success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = `Loaded preset: ${name}`;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  // Handle deleting preset
  const handleDeletePreset = (presetName: string) => {
    deletePreset(presetName);
    setPresets(loadSavedPresets());

    // Show success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = `Deleted preset: ${presetName}`;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
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
      {isOpen && createPortal(
        <>
          {/* Mobile overlay backdrop */}
          <div className="fixed inset-0 bg-black/50 z-[999] sm:hidden" onClick={() => setIsOpen(false)} />
          
          {/* Panel */}
          <div className="
            fixed sm:fixed inset-0 sm:inset-auto sm:top-4 sm:right-4 
            w-full sm:w-[600px] bg-white sm:rounded-lg shadow-xl z-[1000] 
            border border-gray-200 flex flex-col max-h-[100dvh] sm:max-h-[90vh]
          ">
            <form ref={formRef} onSubmit={handleSubmit} className="divide-y divide-gray-200 h-full flex flex-col overflow-y-auto">
              <div className="px-4 py-3 bg-gray-50 sm:rounded-t-lg flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Agent Settings</h3>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={handleSavePreset}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Save as Preset
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Reset to defaults
                  </button>
                  {/* Close button - moved to rightmost position */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    aria-label="Close settings"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Presets Section */}
              <div className="p-4 space-y-4 flex-shrink-0">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-900">Presets</h4>
                </div>
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <div key={preset.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100">
                      <div className="text-sm font-medium">{preset.name}</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadPreset(preset)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset.name)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {presets.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No presets saved yet
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* Model Settings Section */}
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
                          setLocalSettings({
                            ...localSettings,
                            baseURL: value.endsWith('/') ? value : value + '/'
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
                        <option value="https://api.openai.com/v1/">OpenAI</option>
                        <option value="http://localhost:11434/v1/">Ollama</option>
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
                          'o3-mini',
                          'gpt-4o',
                          'gpt-4o-mini',
                          'llama3.1',
                          'qwen2.5-coder',
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
              <div className="px-4 py-3 bg-gray-50 sm:rounded-b-lg flex justify-end gap-2 flex-shrink-0">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};