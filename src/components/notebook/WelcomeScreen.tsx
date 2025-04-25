import { useState, useEffect } from 'react';
import { InitialUrlParams } from '../../hooks/useNotebookInitialization';
import { showToast } from '../../utils/notebookUtils';
import { IN_BROWSER_PROJECT } from '../../providers/ProjectsProvider';
import { motion } from 'framer-motion';
import { FaRobot, FaRegLightbulb } from 'react-icons/fa';
import { BiCodeAlt } from 'react-icons/bi';
import { RiTeamLine } from 'react-icons/ri';
import AgentConfigDialog, { AgentConfigData } from './AgentConfigDialog';

interface WelcomeScreenProps {
    urlParams: InitialUrlParams | null;
    isLoggedIn: boolean;
    onStartNewChat: () => void;
    onStartFromAgent: (agentId: string, projectId?: string) => void;
    onCreateAgentTemplate: (agentData: AgentConfigData) => Promise<void>;
    onEditAgent?: (workspace: string, agentId: string) => Promise<void>;
    onOpenFile: (projectId: string | undefined, filePath: string) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    urlParams,
    isLoggedIn,
    onStartNewChat,
    onStartFromAgent,
    onCreateAgentTemplate,
    onEditAgent,
    onOpenFile
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isAgentLoading, setIsAgentLoading] = useState(false);
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [isCreatingAgent, setIsCreatingAgent] = useState(false);
    const [isEditingAgent, setIsEditingAgent] = useState(false);

    const handleStartNewChat = async () => {
        setIsLoading(true);
        try {
            await onStartNewChat();
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartFromAgentClick = async () => {
        if (urlParams?.agentId) {
            if (!isLoggedIn) {
                showToast("Please log in to start from an agent template.", "warning");
                // Optional: trigger login flow here or provide a login button
                return;
            }
            setIsAgentLoading(true);
            try {
                await onStartFromAgent(urlParams.agentId, urlParams.projectId || undefined);
            } finally {
                setIsAgentLoading(false);
            }
        }
    };

    const handleEditAgentClick = async () => {
        if (urlParams?.edit && onEditAgent) {
            if (!isLoggedIn) {
                showToast("Please log in to edit an agent.", "warning");
                return;
            }
            setIsEditingAgent(true);
            try {
                await onEditAgent(urlParams.edit.workspace, urlParams.edit.agentId);
            } finally {
                setIsEditingAgent(false);
            }
        }
    };

    const handleCreateAgent = () => {
        setIsConfigDialogOpen(true);
    };

    const handleConfigDialogConfirm = async (agentData: AgentConfigData) => {
        /* // Temporarily comment out login check for testing
        if (!isLoggedIn) {
            showToast("Please log in to create an agent template.", "warning");
            setIsConfigDialogOpen(false);
            return;
        }
        */

        setIsCreatingAgent(true);
        try {
            await onCreateAgentTemplate(agentData);
            setIsConfigDialogOpen(false);
        } catch (error) {
            console.error('Error creating agent template:', error);
            showToast("Failed to create agent template", "error");
        } finally {
            setIsCreatingAgent(false);
        }
    };

    const handleOpenFileClick = () => {
        if (urlParams?.filePath) {
            // Check login for remote projects
            if (urlParams.projectId && urlParams.projectId !== IN_BROWSER_PROJECT.id && !isLoggedIn) {
                showToast("Please log in to open remote notebooks.", "warning");
                return;
            }
            onOpenFile(urlParams.projectId || undefined, urlParams.filePath);
        }
    };

    // Auto-open file from URL params when component mounts
    useEffect(() => {
        if (urlParams?.filePath) {
            // Check login for remote projects
            if (urlParams.projectId && urlParams.projectId !== IN_BROWSER_PROJECT.id && !isLoggedIn) {
                showToast("Please log in to open remote notebooks.", "warning");
                return;
            }
            // Automatically open the file
            onOpenFile(urlParams.projectId || undefined, urlParams.filePath);
        }
    }, [urlParams, isLoggedIn, onOpenFile]);

    const fadeInUp = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex-1 bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-auto">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-5">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }}/>
            </div>

            <motion.div
                className="max-w-4xl w-full text-center space-y-6 sm:space-y-8 relative z-10"
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: {
                            staggerChildren: 0.2
                        }
                    }
                }}
            >
                {/* Header Section */}
                <motion.div variants={fadeInUp} className="space-y-2 sm:space-y-4">
                    <div className="flex justify-center items-center space-x-3">
                        <FaRobot className="w-8 h-8 sm:w-12 sm:h-12 text-blue-600" />
                        <h1 className="text-3xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 py-1 leading-normal">
                            Hypha Agent Lab
                        </h1>
                    </div>
                    <p className="text-lg sm:text-xl text-gray-600">
                        Create, configure, and collaborate on AI agents
                    </p>
                </motion.div>

                {/* Features Grid */}
                <motion.div
                    variants={fadeInUp}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 my-6 sm:my-12"
                >
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                        <FaRegLightbulb className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 mx-auto mb-3 sm:mb-4" />
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 sm:mb-2">Intelligent Agents</h3>
                        <p className="text-sm sm:text-base text-gray-600">Build and customize AI agents for your specific needs</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                        <BiCodeAlt className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mx-auto mb-3 sm:mb-4" />
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 sm:mb-2">Code Integration</h3>
                        <p className="text-sm sm:text-base text-gray-600">Seamlessly integrate with your development workflow</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 sm:col-span-2 lg:col-span-1">
                        <RiTeamLine className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mx-auto mb-3 sm:mb-4" />
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 sm:mb-2">Collaboration</h3>
                        <p className="text-sm sm:text-base text-gray-600">Work together with your team on agent development</p>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div variants={fadeInUp} className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                        {/* Conditional Primary Button */}
                        {urlParams?.edit && onEditAgent ? (
                            // If edit param is present, make Edit Agent button primary
                            <motion.button
                                onClick={handleEditAgentClick}
                                disabled={isEditingAgent}
                                className={`
                                    relative overflow-hidden px-6 sm:px-8 py-3 sm:py-4 rounded-xl
                                    bg-gradient-to-r from-blue-600 to-indigo-600
                                    text-white text-base sm:text-lg font-medium
                                    transform hover:-translate-y-1 hover:shadow-xl
                                    transition-all duration-300
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                    w-full sm:w-auto order-first
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors duration-300" />
                                <div className="relative flex items-center justify-center space-x-2">
                                    {isEditingAgent ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            <span>Loading Agent...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="truncate">
                                                Edit: {urlParams.edit.agentId.split('/').pop() || 'Agent'}
                                                {urlParams.edit.workspace && ` (in ${urlParams.edit.workspace})`}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </motion.button>
                        ) : urlParams?.agentId ? (
                            // If agentId param is present, make Start from Agent button primary
                            <motion.button
                                onClick={handleStartFromAgentClick}
                                disabled={isAgentLoading}
                                className={`
                                    relative overflow-hidden px-6 sm:px-8 py-3 sm:py-4 rounded-xl
                                    bg-gradient-to-r from-blue-600 to-indigo-600
                                    text-white text-base sm:text-lg font-medium
                                    transform hover:-translate-y-1 hover:shadow-xl
                                    transition-all duration-300
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                    w-full sm:w-auto order-first
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors duration-300" />
                                <div className="relative flex items-center justify-center space-x-2">
                                    {isAgentLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            <span>Loading Agent...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="truncate">
                                                Start from: {urlParams.agentId.split('/').pop() || 'Agent'}
                                                {urlParams.projectId && ` (in ${urlParams.projectId})`}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </motion.button>
                        ) : (
                            // Default primary button - Start New Chat
                            <motion.button
                                onClick={handleStartNewChat}
                                disabled={isLoading}
                                className={`
                                    relative overflow-hidden px-6 sm:px-8 py-3 sm:py-4 rounded-xl
                                    bg-gradient-to-r from-blue-600 to-indigo-600
                                    text-white text-base sm:text-lg font-medium
                                    transform hover:-translate-y-1 hover:shadow-xl
                                    transition-all duration-300
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                    w-full sm:w-auto
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors duration-300" />
                                <div className="relative flex items-center justify-center space-x-2">
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            <span>Starting...</span>
                                        </>
                                    ) : (
                                        'Start New Chat'
                                    )}
                                </div>
                            </motion.button>
                        )}

                        {/* Secondary Buttons */}
                        {/* Create Agent - Always shown unless we're editing an agent */}
                        {!(urlParams?.edit && onEditAgent) && (
                            <motion.button
                                onClick={handleCreateAgent}
                                disabled={isCreatingAgent}
                                className={`
                                    relative overflow-hidden px-6 sm:px-8 py-3 sm:py-4 rounded-xl
                                    border-2 border-indigo-600 text-indigo-600
                                    text-base sm:text-lg font-medium bg-white/80 backdrop-blur-sm
                                    transform hover:-translate-y-1 hover:shadow-xl hover:bg-indigo-50
                                    transition-all duration-300
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                                    w-full sm:w-auto
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="relative flex items-center justify-center space-x-2">
                                    {isCreatingAgent ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        'Create Agent'
                                    )}
                                </div>
                            </motion.button>
                        )}

                        {/* Start New Chat - Only shown as secondary when we have edit or agentId params */}
                        {(urlParams?.edit || urlParams?.agentId) && (
                            <motion.button
                                onClick={handleStartNewChat}
                                disabled={isLoading}
                                className={`
                                    relative overflow-hidden px-6 sm:px-8 py-3 sm:py-4 rounded-xl
                                    border-2 border-indigo-600 text-indigo-600
                                    text-base sm:text-lg font-medium bg-white/80 backdrop-blur-sm
                                    transform hover:-translate-y-1 hover:shadow-xl hover:bg-indigo-50
                                    transition-all duration-300
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                                    w-full sm:w-auto
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="relative flex items-center justify-center space-x-2">
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            <span>Starting...</span>
                                        </>
                                    ) : (
                                        'Start New Chat'
                                    )}
                                </div>
                            </motion.button>
                        )}

                        {/* File Open Button - Only show if URL has a file parameter */}
                        {urlParams?.filePath && (
                            <motion.button
                                onClick={handleOpenFileClick}
                                className={`
                                    relative overflow-hidden px-6 sm:px-8 py-3 sm:py-4 rounded-xl
                                    border-2 border-green-600 text-green-600
                                    text-base sm:text-lg font-medium bg-white/80 backdrop-blur-sm
                                    transform hover:-translate-y-1 hover:shadow-xl hover:bg-green-50
                                    transition-all duration-300
                                    group focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
                                    w-full sm:w-auto
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="relative flex items-center justify-center space-x-2">
                                    Open File: {urlParams.filePath.split('/').pop()}
                                </div>
                            </motion.button>
                        )}
                    </div>
                    {!isLoggedIn && (urlParams?.agentId || urlParams?.edit || (urlParams?.projectId && urlParams?.projectId !== IN_BROWSER_PROJECT.id)) && (
                        <motion.div
                            variants={fadeInUp}
                            className="mt-4 sm:mt-6 text-xs sm:text-sm bg-amber-50 text-amber-800 px-4 sm:px-6 py-2 sm:py-3 rounded-lg inline-block border border-amber-200"
                        >
                            <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>Login is required to start from agents, edit agents, or open notebooks from remote projects</span>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </motion.div>

            {/* Agent Config Dialog */}
            <AgentConfigDialog
                isOpen={isConfigDialogOpen}
                onClose={() => setIsConfigDialogOpen(false)}
                onConfirm={handleConfigDialogConfirm}
            />
        </div>
    );
};

export default WelcomeScreen;