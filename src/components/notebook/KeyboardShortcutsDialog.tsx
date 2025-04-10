import React from 'react';
import { Dialog } from '@headlessui/react';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const shortcuts = [
    { key: 'Shift + Enter', description: 'Run the current cell and select the cell below' },
    { key: 'Ctrl/Cmd + Enter', description: 'Regenerate response (when in a markdown cell)' },
    { key: 'Ctrl/Cmd + B', description: 'Insert a new code cell below' },
    { key: 'Ctrl/Cmd + Shift + Enter', description: 'Run all cells' },
    { key: 'Ctrl/Cmd + S', description: 'Save notebook' },
    { key: 'Esc', description: 'Enter command mode (when cell is focused)' },
    { key: 'Enter', description: 'Enter edit mode (when cell is focused)' },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg rounded bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-medium mb-4">Keyboard Shortcuts</Dialog.Title>

          <div className="space-y-2">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex justify-between gap-4 py-1">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{shortcut.key}</kbd>
                <span className="text-gray-600">{shortcut.description}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog; 