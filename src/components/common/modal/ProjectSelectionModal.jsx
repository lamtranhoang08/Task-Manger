// src/components/common/modal/ProjectSelectionModal.jsx
import React from 'react';
import { X, Folder } from 'lucide-react';

const ProjectSelectionModal = ({ open, onClose, projects, onProjectSelected }) => {
  if (!open) return null;

  // Add defensive check
  if (typeof onProjectSelected !== 'function') {
    console.error('onProjectSelected is not a function:', onProjectSelected);
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-md">
          <div className="text-red-600">
            Error: onProjectSelected callback is missing or invalid
          </div>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Select a Project</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Which project would you like to invite team members to?
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => onProjectSelected(project.id)}
              className="w-full flex items-center space-x-3 p-3 text-left rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <Folder className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">{project.name}</p>
                <p className="text-sm text-gray-500">{project.status}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSelectionModal;