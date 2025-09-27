// src/components/common/modal/TaskModal.jsx - Enhanced with project context
import React, { useEffect } from 'react';
import TaskForm from '../../tasks/TaskForm';
import { X, Sparkles, Folder } from 'lucide-react';

export default function TaskModal({ 
  open, 
  onClose, 
  onSubmit, 
  initialData, 
  isEditing, 
  projectContext = null // New prop to handle project context
}) {
  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      document.addEventListener('keydown', handleEsc);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleFormSubmit = (formData) => {
    onSubmit(formData);
    // Don't close here - let parent handle it
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Determine if we're in project context
  const isProjectContext = projectContext && projectContext.id;
  const contextualTitle = isProjectContext 
    ? (isEditing ? 'Edit Task' : `Add Task to ${projectContext.name}`)
    : (isEditing ? 'Edit Task' : 'Create New Task');
  
  const contextualSubtitle = isProjectContext
    ? (isEditing ? 'Update your task details' : 'Add a new task to this project')
    : (isEditing ? 'Update your task details' : 'Add a new task to stay organized');

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col transform transition-all duration-200 scale-100">
        {/* Enhanced Header - Fixed */}
        <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {contextualTitle}
                </h2>
                <p className="text-blue-100 text-sm">
                  {contextualSubtitle}
                </p>
                {/* Project context indicator */}
                {isProjectContext && !isEditing && (
                  <div className="flex items-center mt-2 px-3 py-1 bg-white/20 rounded-full">
                    <Folder className="w-3 h-3 text-blue-100 mr-1" />
                    <span className="text-xs text-blue-100 font-medium">
                      {projectContext.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-all duration-200"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50">
          <div className="p-6">
            <TaskForm
              onSubmit={handleFormSubmit}
              onCancel={onClose}
              initialData={initialData}
              isEditing={isEditing}
              preselectedProjectId={isProjectContext ? projectContext.id : null}
              allowProjectSelection={!isProjectContext} // Disable project selection when in project context
              projectContext={projectContext} // Pass project context for display
            />
          </div>
        </div>
      </div>
    </div>
  );
}