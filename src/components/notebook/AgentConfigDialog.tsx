import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { IoFlaskOutline, IoCodeOutline, IoDocumentOutline, IoGlobeOutline, IoAnalytics } from 'react-icons/io5';
import { BiBot } from 'react-icons/bi';
import { NotebookCell } from '../../types/notebook';
import { AgentSettings, DefaultAgentConfig } from '../../utils/chatCompletion';

// Define agent templates
const agentTemplates = [
  {
    id: 'assistant',
    name: 'General Assistant',
    description: 'A versatile AI assistant for answering questions and providing information.',
    icon: <BiBot className="w-10 h-10 text-blue-600" />,
    initialPrompt: 'You are a helpful, accurate, and friendly AI assistant.'
  },
  {
    id: 'coder',
    name: 'Code Assistant',
    description: 'An AI assistant focused on helping with programming and development tasks.',
    icon: <IoCodeOutline className="w-10 h-10 text-green-600" />,
    initialPrompt: 'You are a skilled programming assistant with deep knowledge of software development best practices. Help users write, debug, and improve their code.'
  },
  {
    id: 'researcher',
    name: 'Research Assistant',
    description: 'An AI that helps with academic research, paper analysis, and literature review.',
    icon: <IoDocumentOutline className="w-10 h-10 text-purple-600" />,
    initialPrompt: 'You are a research assistant AI with expertise in analyzing academic papers, compiling literature reviews, and helping with research tasks.'
  },
  {
    id: 'data',
    name: 'Data Analyst',
    description: 'An AI specializing in data analysis, visualization, and interpretation.',
    icon: <IoAnalytics className="w-10 h-10 text-yellow-600" />,
    initialPrompt: 'You are a data analysis expert that can help users understand, visualize, and interpret data. You can provide insights and recommendations based on data patterns.'
  },
  {
    id: 'web',
    name: 'Web Assistant',
    description: 'An AI specializing in web development, HTML, CSS, and JavaScript.',
    icon: <IoGlobeOutline className="w-10 h-10 text-red-600" />,
    initialPrompt: 'You are a web development specialist with expertise in HTML, CSS, JavaScript, and modern web frameworks. Help users create and improve web applications.'
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Create a completely custom agent with your own configuration.',
    icon: <IoFlaskOutline className="w-10 h-10 text-gray-600" />,
    initialPrompt: ''
  }
];

const licenses = [
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-4.0',
  'MIT',
  'Apache-2.0'
];

export interface AgentConfigData {
  name: string;
  description: string;
  version: string;
  license: string;
  welcomeMessage: string;
  initialPrompt: string;
}

interface AgentConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agentData: AgentConfigData) => void;
  systemCell?: NotebookCell | null;
}

const AgentConfigDialog: React.FC<AgentConfigDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  systemCell
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('0.1.0');
  const [license, setLicense] = useState(licenses[0]);
  const [welcomeMessage, setWelcomeMessage] = useState('Hi, how can I help you today?');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [step, setStep] = useState(1);
  
  // Reset the form when the dialog is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplate(null);
      setName('');
      setDescription('');
      setVersion('0.1.0');
      setLicense(licenses[0]);
      setWelcomeMessage('Hi, how can I help you today?');
      setInitialPrompt('');
      setStep(1);
    }
  }, [isOpen]);
  
  // Update fields when a template is selected
  useEffect(() => {
    if (selectedTemplate) {
      const template = agentTemplates.find(t => t.id === selectedTemplate);
      if (template) {
        setName(`${template.name}`);
        setDescription(`A ${template.name.toLowerCase()} powered by AICell Lab`);
        setInitialPrompt(template.initialPrompt);
      }
    }
  }, [selectedTemplate]);

  const handleSubmit = () => {
    onConfirm({
      name,
      description,
      version,
      license,
      welcomeMessage,
      initialPrompt,
    });
  };
  
  const nextStep = () => {
    setStep(2);
  };

  const renderTemplateSelection = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Choose a Template</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {agentTemplates.map(template => (
          <div 
            key={template.id}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all
              ${selectedTemplate === template.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <div className="flex items-center mb-2">
              {template.icon}
              <h3 className="text-lg font-medium ml-3">{template.name}</h3>
            </div>
            <p className="text-gray-600 text-sm">{template.description}</p>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
        >
          Cancel
        </button>
        <button
          onClick={nextStep}
          disabled={!selectedTemplate}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            selectedTemplate
              ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderConfigForm = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Configure Your Agent</h2>
      
      <div className="space-y-4">
        {/* Agent Name */}
        <div>
          <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 mb-1">
            Agent Name
          </label>
          <input
            type="text"
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter agent name"
            required
          />
        </div>
        
        {/* Agent Description */}
        <div>
          <label htmlFor="agent-description" className="block text-sm font-medium text-gray-700 mb-1">
            Agent Description
          </label>
          <textarea
            id="agent-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe what your agent does"
            required
          />
        </div>
        
        {/* Version and License in a flex row */}
        <div className="flex space-x-4">
          <div className="flex-1">
            <label htmlFor="agent-version" className="block text-sm font-medium text-gray-700 mb-1">
              Version
            </label>
            <input
              type="text"
              id="agent-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.1.0"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="agent-license" className="block text-sm font-medium text-gray-700 mb-1">
              License
            </label>
            <select
              id="agent-license"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {licenses.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Welcome Message */}
        <div>
          <label htmlFor="welcome-message" className="block text-sm font-medium text-gray-700 mb-1">
            Welcome Message
          </label>
          <textarea
            id="welcome-message"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Welcome message when agent starts"
          />
        </div>
        
        {/* Initial System Prompt */}
        <div>
          <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700 mb-1">
            System Configuration (From the first system configuration cell in the current notebook)
            <span className="ml-2 text-xs text-gray-500">
              (This initializes the agent and provides instructions for its behavior)
            </span>
          </label>
          <textarea
            id="initialPrompt"
            rows={10}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            value={initialPrompt}
            onChange={(e) => setInitialPrompt(e.target.value)}
            placeholder="Enter instructions for your agent..."
          />
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button
          onClick={() => setStep(1)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !initialPrompt.trim()}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            name.trim() && initialPrompt.trim()
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Create Agent
        </button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full rounded bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
          <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
            Create New Agent
          </Dialog.Title>
          
          {step === 1 ? renderTemplateSelection() : renderConfigForm()}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default AgentConfigDialog; 