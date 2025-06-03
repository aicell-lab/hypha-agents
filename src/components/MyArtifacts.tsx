import React, { useState, useEffect } from 'react';
import { useHyphaStore } from '../store/hyphaStore';
import ResourceCard from './ResourceCard';
import { Link, useNavigate } from 'react-router-dom';
import { RiLoginBoxLine } from 'react-icons/ri';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';
import AdminResourceCard from './AdminResourceCard';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { SITE_ID, SERVER_URL } from '../utils/env';

interface Artifact {
  id: string;
  alias: string;
  manifest: any;
  type: string;
  created_by: string;
  versions: Array<{
    version: string;
    comment: string;
    created_at: number;
  }>;
  staging?: any[];
}

const MyArtifacts: React.FC = () => {
  const { artifactManager, user, isLoggedIn } = useHyphaStore();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStagedOnly, setShowStagedOnly] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [artifactToDelete, setArtifactToDelete] = useState<Artifact | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn && user) {
      loadArtifacts();
    }
  }, [artifactManager, user, isLoggedIn, showStagedOnly]);

  const loadArtifacts = async () => {
    if (!artifactManager || !user) return;

    try {
      setLoading(true);
      const filters = {
        created_by: user.id,
        version: showStagedOnly ? "stage" : "committed",
      };

      const response = await artifactManager.list({
        parent_id: "hypha-agents/agents",
        filters: filters,
        stage: showStagedOnly ? true : "all",
        limit: 100,
        _rkwargs: true
      });

      console.log(response);

      setArtifacts(response);
      setError(null);
    } catch (err) {
      console.error('Error loading artifacts:', err);
      setError('Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArtifact = async () => {
    if (!artifactToDelete || !artifactManager) return;

    try {
      setLoading(true);


      await artifactManager.delete({
        artifact_id: artifactToDelete.id,
        version: artifactToDelete.versions && artifactToDelete.versions.length > 0 ? "stage" : null,
        delete_files: true,
        recursive: true,
        _rkwargs: true
      });

      // Refresh the artifacts list
      await loadArtifacts();
      setIsDeleteDialogOpen(false);
      setArtifactToDelete(null);
    } catch (err) {
      console.error('Error deleting artifact:', err);
      setError('Failed to delete artifact');
    } finally {
      setLoading(false);
    }
  };
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="mb-4">
            <RiLoginBoxLine className="mx-auto h-12 w-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Login Required
          </h2>
          <p className="text-gray-500 mb-4">
            Please login to view your uploaded models
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Main Content Area */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">
              My Agents
            </h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Switch
                  checked={showStagedOnly}
                  onChange={setShowStagedOnly}
                  className={`${
                    showStagedOnly ? 'bg-blue-600' : 'bg-gray-200'
                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span className="sr-only">Show staged artifacts only</span>
                  <span
                    className={`${
                      showStagedOnly ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
                <span className="ml-2 text-sm text-gray-600">
                  {showStagedOnly ? 'Staged Only' : 'All Versions'}
                </span>
              </div>
              <button
                type="button"
                onClick={loadArtifacts}
                disabled={loading}
                className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ArrowPathIcon
                  className={`-ml-0.5 mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <div className="text-xl font-semibold text-gray-700">Loading artifacts...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500">{error}</div>
          </div>
        ) : artifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="mb-4">You haven't any agent yet</p>
            <Link
              to="/lab"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Your First Agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artifacts.map((artifact) => (
              <div key={artifact.id}>
                <AdminResourceCard
                  title={artifact.manifest?.name || artifact.alias}
                  description={artifact.manifest?.description || 'No description'}
                  tags={[
                    `v${artifact.versions?.length || 0}`,
                    ...(artifact.manifest?.tags || [])
                  ]}
                  image={artifact.manifest?.cover || undefined}
                  downloadUrl={`${SERVER_URL}/${SITE_ID}/artifacts/${artifact.id.split('/').pop()}/create-zip-file`}
                  onEdit={artifact.id} // Pass the artifact ID directly for the edit URL
                  onDelete={() => {
                    setArtifactToDelete(artifact);
                    setIsDeleteDialogOpen(true);
                  }}
                  isStaged={!!artifact.staging}
                  status={artifact.staging ? 'staged' : 'published'}
                  artifactType={artifact.type}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Transition.Root show={isDeleteDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setIsDeleteDialogOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600"  />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Remove Staged Artifact
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Are you sure you want to remove this staged artifact? This will only remove the staged version - any published versions will remain unchanged. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                      onClick={handleDeleteArtifact}
                      disabled={loading}
                    >
                      {loading ? 'Removing...' : 'Remove Staged'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                      onClick={() => {
                        setIsDeleteDialogOpen(false);
                        setArtifactToDelete(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default MyArtifacts;