// src/components/common/modal/TaskModal.jsx - Modernized
import React, { useEffect } from 'react';
import TaskForm from '../../tasks/TaskForm';
import { X, Sparkles } from 'lucide-react';

export default function TaskModal({ open, onClose, onSubmit, initialData, isEditing }) {
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

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden transform transition-all duration-200 scale-100">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isEditing ? 'Edit Task' : 'Create New Task'}
                </h2>
                <p className="text-blue-100 text-sm">
                  {isEditing ? 'Update your task details' : 'Add a new task to stay organized'}
                </p>
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

        {/* Form Body */}
        <div className="p-6 bg-gradient-to-b from-white to-slate-50">
          <TaskForm
            onSubmit={handleFormSubmit}
            onCancel={onClose}
            initialData={initialData}
            isEditing={isEditing}
            allowProjectSelection={true}
          />
        </div>
      </div>
    </div>
  );
}