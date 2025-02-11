import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHyphaStore } from '../store/hyphaStore';
import Chat from '../components/Chat';

interface AgentConfig {
  name: string;
  profile?: string;
  goal?: string;
  model?: string;
  stream?: boolean;
  instructions?: string;
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
  const [welcomeMessage, setWelcomeMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadAgentConfig = async () => {
      if (!artifactManager || !id) return;

      try {
        setLoading(true);
        const artifact = await artifactManager.read({
          artifact_id: `elia-platform/${id}`,
          _rkwargs: true
        });
        const manifest = artifact.manifest as ArtifactManifest;

        if (manifest.agent_config) {
          // Merge manifest data into agent config
          const config: AgentConfig = {
            name: manifest.name,
            profile: manifest.agent_config.profile || 'AI Assistant',
            goal: manifest.agent_config.goal || manifest.description,
            model: manifest.agent_config.model || 'gpt-4o-mini',
            stream: manifest.agent_config.stream ?? true,
            instructions: manifest.agent_config.instructions || manifest.description
          };
          setAgentConfig(config);
          setWelcomeMessage(manifest.welcomeMessage);
        } else {
          setError('This resource is not configured as an agent');
          setTimeout(() => navigate('/'), 3000); // Redirect after 3 seconds
        }
      } catch (err) {
        console.error('Error loading agent config:', err);
        setError('Failed to load agent configuration');
      } finally {
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
    <div className="h-screen bg-gray-50">
      <div className="h-3/4 w-full max-w-6xl mx-auto">
        <Chat 
          agentConfig={agentConfig!} 
          welcomeMessage={welcomeMessage}
          className="h-full"
        />
      </div>
    </div>
  );
};

export default ChatPage; 