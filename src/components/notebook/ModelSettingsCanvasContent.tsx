import React, { useState, useEffect } from 'react';
import { AgentSettings } from '../../utils/chatCompletion';
import { loadModelSettings, saveModelSettings, loadSavedPresets, savePreset, deletePreset, ModelPreset } from '../../utils/modelSettings';
import ModelConfigForm from '../shared/ModelConfigForm';

interface ModelSettingsCanvasContentProps {
  onSettingsChange: (settings: AgentSettings) => void;
}

const ModelSettingsCanvasContent: React.FC<ModelSettingsCanvasContentProps> = ({
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<AgentSettings>(loadModelSettings());
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);

  // Load presets on mount
  useEffect(() => {
    setPresets(loadSavedPresets());
  }, []);

  const handleSaveSettings = () => {
    // Save settings to localStorage
    saveModelSettings(settings);
    
    // Update parent component
    onSettingsChange(settings);
    
    // Show success message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
    messageDiv.textContent = 'Settings saved successfully';
    document.body.appendChild(messageDiv);
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      setTimeout(() => document.body.removeChild(messageDiv), 500);
    }, 2000);
  };

  const handleSavePreset = () => {
    const name = prompt('Enter preset name:');
    if (!name) return;
    
    const preset: ModelPreset = {
      ...settings,
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

  const handleLoadPreset = (preset: ModelPreset) => {
    const { name, description, ...presetSettings } = preset;
    setSettings(presetSettings);
    
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

  const handleConfirmDeletePreset = (presetName: string) => {
    setPresetToDelete(presetName);
    setShowDeleteConfirm(true);
  };

  const handleDeletePreset = () => {
    if (presetToDelete) {
      deletePreset(presetToDelete);
      setPresets(loadSavedPresets());
      
      // Show success message
      const messageDiv = document.createElement('div');
      messageDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-500';
      messageDiv.textContent = `Deleted preset: ${presetToDelete}`;
      document.body.appendChild(messageDiv);
      setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(messageDiv), 500);
      }, 2000);

      // Reset state
      setPresetToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setPresetToDelete(null);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Presets Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Presets</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
            {presets.map((preset) => (
              <div key={preset.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
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
                    onClick={() => handleConfirmDeletePreset(preset.name)}
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
          <button
            type="button"
            onClick={handleSavePreset}
            className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Current as Preset
          </button>
        </div>
        
        {/* Settings Form */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">Configuration</h3>
          <ModelConfigForm
            settings={settings}
            onSettingsChange={setSettings}
          />
        </div>
      </div>
      
      {/* Footer with Save Button */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 flex justify-end gap-3 sticky bottom-0">
        <button
          type="button"
          onClick={handleSaveSettings}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Settings
        </button>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>

            {/* Modal panel */}
            <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-red-100 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">
                      Delete Preset
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete the preset "{presetToDelete}"? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDeletePreset}
                  className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSettingsCanvasContent;
