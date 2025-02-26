import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHyphaStore } from '../store/hyphaStore';
import { LinearProgress } from '@mui/material';
import { SITE_ID } from '../utils/env';

const Create: React.FC = () => {
  const navigate = useNavigate();
  const { artifactManager } = useHyphaStore();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    license: 'Apache-2.0'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateAgent = async () => {
    if (!artifactManager) {
      setError('Artifact manager not available');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const manifest = {
        name: formData.name,
        description: formData.description,
        version: formData.version,
        license: formData.license,
        type: 'agent',
        created_at: new Date().toISOString()
      };

      const artifact = await artifactManager.create({
        parent_id: `${SITE_ID}/agents`,
        type: "agent",
        manifest,
        config: {},
        version: "stage",
        _rkwargs: true
      });

      const editPath = `/edit/${encodeURIComponent(artifact.id)}`;
      navigate(editPath);
    } catch (err) {
      console.error('Agent creation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New AI Agent</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="My Telecom Agent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-32"
                placeholder="Describe your agent's purpose and capabilities..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Version
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData({...formData, version: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License
                </label>
                <select
                  value={formData.license}
                  onChange={(e) => setFormData({...formData, license: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Apache-2.0">Apache License 2.0</option>
                  <option value="MIT">MIT License</option>
                  <option value="BSD-3-Clause">BSD 3-Clause</option>
                  <option value="Proprietary">Proprietary</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={handleCreateAgent}
                disabled={loading || !formData.name.trim()}
                className={`w-full flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  loading || !formData.name.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {loading ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </div>

          {loading && <LinearProgress className="mt-4" />}
        </div>
      </div>
    </div>
  );
};

export default Create; 