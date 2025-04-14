import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { NotebookCell, OutputItem } from '../../types/notebook';

interface PublishAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string) => void;
  title: string;
  systemCell: NotebookCell | null;
  notebookTitle: string;
}

const PublishAgentDialog: React.FC<PublishAgentDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  systemCell,
  notebookTitle
}) => {
  const [name, setName] = useState(notebookTitle || 'Untitled Agent');
  const [description, setDescription] = useState('');
  
  const handleSubmit = () => {
    onConfirm(name, description);
  };

  // Format cell output for display
  const formatCellOutput = (cell: NotebookCell | null) => {
    if (!cell || !cell.output || cell.output.length === 0) {
      return 'No output available';
    }

    return cell.output.map((output: OutputItem, index: number) => {
      if (output.type === 'stream') {
        return (
          <pre key={index} className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
            {output.content || ''}
          </pre>
        );
      } else if (output.type === 'execute_result' || output.type === 'display_data') {
        if (output.attrs?.html) {
          return (
            <div 
              key={index} 
              className="text-xs max-h-40 overflow-auto" 
              dangerouslySetInnerHTML={{ __html: output.attrs.html as string }} 
            />
          );
        } else {
          return (
            <pre key={index} className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
              {output.content}
            </pre>
          );
        }
      }
      return null;
    });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full rounded bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
            {title}
          </Dialog.Title>
          
          <div className="mb-6 space-y-4">
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
            
            <div>
              <label htmlFor="agent-description" className="block text-sm font-medium text-gray-700 mb-1">
                Agent Description
              </label>
              <textarea
                id="agent-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe what your agent does"
                required
              />
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Agent Configuration Preview</h3>
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50 space-y-2">
                {systemCell ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-700">System Cell Content:</div>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-32 mt-1">
                      {systemCell.content}
                    </pre>
                    
                    <div className="text-xs font-semibold text-gray-700 mt-3">System Cell Output:</div>
                    <div className="mt-1">
                      {formatCellOutput(systemCell)}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No system cell found</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                name.trim() 
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Publish Agent
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default PublishAgentDialog; 