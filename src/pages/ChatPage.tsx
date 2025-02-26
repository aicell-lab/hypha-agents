import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHyphaStore } from '../store/hyphaStore';
import Chat from '../components/chat/Chat';
import { ThebeProvider } from '../components/chat/ThebeProvider';
import { SITE_ID } from '../utils/env';

interface AgentConfig {
  name: string;
  profile?: string;
  goal?: string;
  model?: string;
  stream?: boolean;
  instructions?: string;
  welcomeMessage?: string;
}

interface ArtifactManifest {
  name: string;
  description: string;
  agent_config: AgentConfig;
  welcomeMessage?: string;
}

const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { artifactManager, isLoggedIn } = useHyphaStore();
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAgentConfig = async () => {
      if (!artifactManager || !id) return;

      try {
        setLoading(true);
        const artifact = await artifactManager.read({
          artifact_id: `${SITE_ID}/${id}`,
          _rkwargs: true
        });
        const manifest = artifact.manifest as ArtifactManifest;

        if (manifest.agent_config) {
          // Create the complete config object before setting state
          const config: AgentConfig = {
            ...manifest.agent_config, // Keep original agent config
            name: manifest.name,
            profile: manifest.agent_config.profile || 'AI Assistant',
            goal: manifest.agent_config.goal || manifest.description,
            model: manifest.agent_config.model || 'gpt-4-mini',
            stream: manifest.agent_config.stream ?? true,
            instructions: manifest.agent_config.instructions || manifest.description,
            welcomeMessage: manifest.welcomeMessage
          };
          
          // Only set the config once it's complete
          setAgentConfig(config);
          setLoading(false);
        } else {
          setError('This resource is not configured as an agent');
          setLoading(false);
          setTimeout(() => navigate('/'), 3000);
        }
      } catch (err) {
        console.error('Error loading agent config:', err);
        setError('Failed to load agent configuration');
        setLoading(false);
      }
    };

    loadAgentConfig();
  }, [artifactManager, id, navigate]); // Only depend on these values

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">Please log in to chat with agents</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading agent configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThebeProvider>
      <div className="flex flex-col flex-1 min-h-0 bg-[#F3F4F6]">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
          {agentConfig && (
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <button
                onClick={() => navigate('/my-agents')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Back to My Agents"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-md">
                <span className="text-white text-lg font-medium">
                  {agentConfig?.name?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <div>
                <h1 className="text-lg font-medium text-gray-900">
                  {agentConfig?.name || 'AI Assistant'}
                </h1>
                <p className="text-sm text-gray-500">
                  {agentConfig?.profile || 'Ready to help'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Component - Only render when we have a complete config */}
        {agentConfig && !loading && !error && (
          <Chat
            agentConfig={agentConfig}
            className="flex-1"
            artifactId={id}
          />
        )}
      </div>
    </ThebeProvider>
  );
};

export default ChatPage; 