import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AgentSettings, DefaultAgentConfig } from '../../utils/chatCompletion';
import { loadModelSettings, saveModelSettings, loadSavedPresets, savePreset, deletePreset, ModelPreset } from '../../utils/modelSettings';
import ModelConfigForm from '../shared/ModelConfigForm';
import { NotebookMetadata } from '../../types/notebook';

// Define interfaces for our settings
interface ModelSettingsProps {
  settings?: AgentSettings;
  onSettingsChange?: (settings: AgentSettings) => void;
  className?: string;
  notebookMetadata?: NotebookMetadata | null;
}

export const ModelSettingsPanel: React.FC<ModelSettingsProps> = ({
  settings,
  onSettingsChange = () => {},
  className,
  notebookMetadata,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<AgentSettings>(settings || loadModelSettings());
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  // Removed unused state variables
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Get button position for desktop dropdown positioning
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Track button position for dropdown positioning
  const [, setButtonPosition] = useState<{ top: number; right: number } | null>(null);

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
      // Update parent component with new settings
      onSettingsChange(localSettings);

      // Save settings to localStorage
      saveModelSettings(localSettings);

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

    const preset: ModelPreset = {
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
  const handleLoadPreset = (preset: ModelPreset) => {
    const { name, description, ...settings } = preset;
    setLocalSettings(settings);
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
        type="button"
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Model Settings"
        aria-label="Configure model settings"
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
                <h3 className="text-lg font-medium text-gray-900">Model Settings</h3>
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
                {/* Model Settings Section - replaced with ModelConfigForm */}
                <ModelConfigForm
                  settings={localSettings}
                  onSettingsChange={setLocalSettings}
                />
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

export default ModelSettingsPanel;