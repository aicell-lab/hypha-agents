import { AgentSettings, DefaultAgentConfig } from './chatCompletion';

// Constants for localStorage keys
export const MODEL_SETTINGS_STORAGE_KEY = 'current_model_settings';
export const MODEL_PRESETS_STORAGE_KEY = 'model_presets';

// Define preset interface
export interface ModelPreset extends AgentSettings {
  name: string;
  description?: string;
}

// Load model settings from localStorage
export const loadModelSettings = (): AgentSettings => {
  try {
    const stored = localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AgentSettings;
    }
    return DefaultAgentConfig;
  } catch (error) {
    console.error('Error loading model settings from localStorage:', error);
    return DefaultAgentConfig;
  }
};

// Save model settings to localStorage
export const saveModelSettings = (settings: AgentSettings): void => {
  try {
    localStorage.setItem(MODEL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving model settings to localStorage:', error);
  }
};

// Load saved presets from localStorage
export const loadSavedPresets = (): ModelPreset[] => {
  try {
    const stored = localStorage.getItem(MODEL_PRESETS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ModelPreset[];
  } catch (error) {
    console.error('Error loading presets from localStorage:', error);
    return [];
  }
};

// Save preset to localStorage
export const savePreset = (preset: ModelPreset): void => {
  try {
    const presets = loadSavedPresets();
    const existingIndex = presets.findIndex(p => p.name === preset.name);
    
    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }
    
    localStorage.setItem(MODEL_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Error saving preset to localStorage:', error);
  }
};

// Delete preset from localStorage
export const deletePreset = (presetName: string): void => {
  try {
    const presets = loadSavedPresets();
    const filteredPresets = presets.filter(p => p.name !== presetName);
    localStorage.setItem(MODEL_PRESETS_STORAGE_KEY, JSON.stringify(filteredPresets));
  } catch (error) {
    console.error('Error deleting preset from localStorage:', error);
  }
};
