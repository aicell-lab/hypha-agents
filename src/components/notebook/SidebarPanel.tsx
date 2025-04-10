import React from 'react';
import { FaRobot, FaCog } from 'react-icons/fa';
import { AgentSettings } from '../../utils/chatCompletion';

interface SidebarPanelProps {
  activeTab: string;
  agentSettings?: AgentSettings;
  onSettingsChange?: (settings: Partial<AgentSettings>) => void;
}

const SidebarPanel: React.FC<SidebarPanelProps> = ({ 
  activeTab,
  agentSettings,
  onSettingsChange = () => {} 
}) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'agent':
        return (
          <div className="p-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <FaRobot className="text-blue-500" /> Agent Configuration
            </h2>
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-md p-3">
                <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select 
                  id="model-select"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Select AI model"
                  value={agentSettings?.model || 'claude-3-opus-20240229'}
                  onChange={(e) => onSettingsChange({ model: e.target.value })}
                >
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                  <option value="gpt-4o">GPT-4o</option>
                </select>
              </div>
              
              <div className="border border-gray-200 rounded-md p-3">
                <label htmlFor="temperature-slider" className="block text-sm font-medium text-gray-700 mb-1">Temperature: {agentSettings?.temperature || 0.7}</label>
                <input 
                  id="temperature-slider"
                  type="range" 
                  className="w-full" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={agentSettings?.temperature || 0.7}
                  onChange={(e) => onSettingsChange({ temperature: parseFloat(e.target.value) })}
                  aria-label="Temperature setting"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0.0</span>
                  <span>0.5</span>
                  <span>1.0</span>
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-md p-3">
                <label htmlFor="agent-instructions" className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea 
                  id="agent-instructions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Enter instructions for the agent..."
                  value={agentSettings?.instructions || ''}
                  onChange={(e) => onSettingsChange({ instructions: e.target.value })}
                  aria-label="Agent instructions"
                ></textarea>
              </div>
            </div>
          </div>
        );
        
      case 'settings':
        return (
          <div className="p-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <FaCog className="text-blue-500" /> Settings
            </h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="auto-execute" 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" 
                  aria-label="Auto-execute code cells"
                />
                <label htmlFor="auto-execute" className="ml-2 block text-sm text-gray-700">
                  Auto-execute code cells
                </label>
              </div>
              
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="dark-mode" 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" 
                  aria-label="Enable dark mode"
                />
                <label htmlFor="dark-mode" className="ml-2 block text-sm text-gray-700">
                  Dark mode
                </label>
              </div>
              
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="auto-save" 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  defaultChecked={true}
                  aria-label="Auto-save notebook"
                />
                <label htmlFor="auto-save" className="ml-2 block text-sm text-gray-700">
                  Auto-save notebook
                </label>
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="p-4 text-center text-gray-500">
            <p>Content for {activeTab} tab will appear here</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 flex-1">
      {renderContent()}
    </div>
  );
};

export default SidebarPanel; 