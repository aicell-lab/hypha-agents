import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHyphaStore } from '../store/hyphaStore';
import Chat from '../components/chat/Chat';
import { LazyThebeProvider } from '../components/chat/ThebeProvider';
import { ToolProvider } from '../components/chat/ToolProvider';
import { SITE_ID } from '../utils/env';

interface AgentConfig {
  name: string;
  profile?: string;
  goal?: string;
  model?: string;
  stream?: boolean;
  disableStreaming?: boolean;
  instructions?: string;
  startup_script?: string;
  welcomeMessage?: string;
  voice?: string;
  temperature?: number;
  enabled_tools?: string[];
  mode?: 'text' | 'voice';
}

interface ArtifactManifest {
  name: string;
  description: string;
  welcomeMessage?: string;
  // Flattened agent config fields
  profile?: string;
  goal?: string;
  model?: string;
  stream?: boolean;
  disableStreaming?: boolean;
  instructions?: string;
  startup_script?: string;
  voice?: string;
  temperature?: number;
  enabled_tools?: string[];
  mode?: 'text' | 'voice';
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

        // Create the complete config object before setting state
        const config: AgentConfig = {
          name: manifest.name,
          profile: manifest.profile || 'AI Assistant',
          goal: manifest.goal || "A helpful AI assistant",
          model: manifest.model || 'gpt-4-mini',
          stream: manifest.stream ?? true,
          disableStreaming: manifest.disableStreaming,
          instructions: manifest.instructions,
          startup_script: manifest.startup_script,
          welcomeMessage: manifest.welcomeMessage,
          voice: manifest.voice || 'sage',
          temperature: manifest.temperature || 0.8,
          enabled_tools: manifest.enabled_tools,
          mode: manifest.mode || 'text'
        };
        
        // Only set the config once it's complete
        setAgentConfig(config);
        setLoading(false);
      } catch (err) {
        console.error('Error loading agent config:', err);
        setError('Failed to load agent configuration');
        setLoading(false);
      }
    };

    loadAgentConfig();
  }, [artifactManager, id, navigate]);

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
    <LazyThebeProvider>

        <div className="flex flex-col h-full overflow-hidden bg-[#F3F4F6]">
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
            <div className="flex-1 overflow-hidden">
              <Chat
                agentConfig={agentConfig}
                className="h-full"
                artifactId={id}
              />
            </div>
          )}
        </div>

    </LazyThebeProvider>
  );
};

export default ChatPage; 