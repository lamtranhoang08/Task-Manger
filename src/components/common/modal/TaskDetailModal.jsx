// src/components/common/modal/TaskDetailModal.jsx - Production Ready Task Details Modal
import React, { useState, useCallback, useMemo } from 'react';
import { 
  X, 
  Edit3, 
  Trash2, 
  Calendar, 
  User, 
  Flag, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Folder,
  MessageSquare,
  Share2
} from 'lucide-react';

// ============================================================================
// CONSTANTS AND MAPPINGS
// ============================================================================

/**
 * Status display configuration
 */
const STATUS_CONFIG = {
  todo: {
    label: 'To Do',
    color: 'bg-slate-100 text-slate-700',
    icon: Clock,
    dotColor: 'bg-slate-400'
  },
  progress: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-700',
    icon: AlertCircle,
    dotColor: 'bg-blue-500'
  },
  complete: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle2,
    dotColor: 'bg-green-500'
  }
};

/**
 * Priority display configuration
 */
const PRIORITY_CONFIG = {
  low: {
    label: 'Low',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  high: {
    label: 'High',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * TaskDetailModal - Displays comprehensive task information with actions
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether modal is open
 * @param {Function} props.onClose - Close modal handler
 * @param {Object} props.task - Task data object
 * @param {Function} props.onEdit - Edit task handler
 * @param {Function} props.onDelete - Delete task handler
 * @param {Function} props.onStatusChange - Status change handler (disabled)
 * @param {Array} props.availableProjects - Available projects for context
 * @param {Object} props.currentUser - Current user data
 */
export default function TaskDetailModal({
  open,
  onClose,
  task,
  onEdit,
  onDelete,
  onStatusChange, // This prop is now effectively disabled
  availableProjects = [],
  currentUser
}) {
  // ========================================================================
  // STATE AND REFS
  // ========================================================================
  
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  /**
   * Get project information for the task
   */
  const projectInfo = useMemo(() => {
    if (!task?.project_id || !availableProjects.length) return null;
    
    return availableProjects.find(p => p.id === task.project_id);
  }, [task?.project_id, availableProjects]);

  /**
   * Get status configuration
   */
  const statusConfig = useMemo(() => {
    return STATUS_CONFIG[task?.displayStatus] || STATUS_CONFIG.todo;
  }, [task?.displayStatus]);

  /**
   * Get priority configuration
   */
  const priorityConfig = useMemo(() => {
    return PRIORITY_CONFIG[task?.priority] || PRIORITY_CONFIG.medium;
  }, [task?.priority]);

  /**
   * Check if task is overdue
   */
  const isOverdue = useMemo(() => {
    if (!task?.dueDate || task?.displayStatus === 'complete') return false;
    return new Date(task.dueDate) < new Date();
  }, [task?.dueDate, task?.displayStatus]);

  /**
   * Format due date for display
   */
  const formattedDueDate = useMemo(() => {
    if (!task?.dueDate) return null;
    
    const date = new Date(task.dueDate);
    const now = new Date();
    const diffInDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    let timeIndicator = '';
    if (diffInDays === 0) {
      timeIndicator = ' (Due Today)';
    } else if (diffInDays === 1) {
      timeIndicator = ' (Due Tomorrow)';
    } else if (diffInDays > 0) {
      timeIndicator = ` (${diffInDays} days left)`;
    } else {
      timeIndicator = ` (${Math.abs(diffInDays)} days overdue)`;
    }
    
    return formatted + timeIndicator;
  }, [task?.dueDate]);

  /**
   * Get assigned user info
   */
  const assignedUserInfo = useMemo(() => {
    // For now, return current user info if task is assigned
    // This can be expanded when we have full user management
    if (task?.assigned_to === currentUser?.id) {
      return {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar
      };
    }
    return null;
  }, [task?.assigned_to, currentUser]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle task deletion with confirmation
   */
  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    if (actionLoading || !onDelete) return;
    
    setActionLoading(true);
    try {
      await onDelete(task.id);
      onClose(); // Close modal after successful deletion
    } catch (error) {
      console.error('Failed to delete task:', error);
    } finally {
      setActionLoading(false);
      setConfirmDelete(false);
    }
  }, [task?.id, onDelete, onClose, actionLoading, confirmDelete]);

  /**
   * Handle edit button click
   */
  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(task, null); // Pass event as null since we're calling programmatically
      onClose(); // Close detail modal when opening edit
    }
  }, [task, onEdit, onClose]);

  /**
   * Cancel delete confirmation
   */
  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    if (actionLoading) return; // Prevent closing during actions
    setConfirmDelete(false);
    onClose();
  }, [onClose, actionLoading]);

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  /**
   * Render status display (replaces status selector)
   */
  const renderStatusDisplay = () => {
    const statuses = [
      { key: 'todo', label: 'To Do' },
      { key: 'progress', label: 'In Progress' },
      { key: 'complete', label: 'Completed' }
    ];

    return (
      <div className="space-y-1">
        {statuses.map((status) => {
          const config = STATUS_CONFIG[status.key];
          const Icon = config.icon;
          const isActive = task?.displayStatus === status.key;
          
          return (
            <div
              key={status.key}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${
                isActive 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{status.label}</span>
              {isActive && (
                <CheckCircle2 className="w-4 h-4 ml-auto text-blue-600" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Render priority badge
   */
  const renderPriorityBadge = () => (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${priorityConfig.bgColor} ${priorityConfig.color} ${priorityConfig.borderColor}`}>
      <Flag className="w-3 h-3" />
      {priorityConfig.label} Priority
    </div>
  );

  /**
   * Render user avatar
   */
  const renderUserAvatar = (user, size = 'w-8 h-8') => {
    if (user?.avatar) {
      return (
        <img
          src={user.avatar}
          alt={user.name}
          className={`${size} rounded-full object-cover`}
        />
      );
    }
    
    return (
      <div className={`${size} bg-blue-100 rounded-full flex items-center justify-center`}>
        <span className="text-xs font-medium text-blue-700">
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </span>
      </div>
    );
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusConfig.dotColor}`} />
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {task.title || 'Untitled Task'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={actionLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-80px)]">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Status and Priority */}
              <div className="flex items-center gap-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.color}`}>
                  <statusConfig.icon className="w-4 h-4" />
                  {statusConfig.label}
                </div>
                {renderPriorityBadge()}
                {isOverdue && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </div>
                )}
              </div>

              {/* Description */}
              {task.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Description
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {task.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Task Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Due Date */}
                {formattedDueDate && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Due Date
                    </h3>
                    <p className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {formattedDueDate}
                    </p>
                  </div>
                )}

                {/* Project */}
                {projectInfo && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      Project
                    </h3>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                      <Folder className="w-4 h-4" />
                      {projectInfo.name}
                    </div>
                  </div>
                )}

                {/* Assigned To */}
                {assignedUserInfo && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Assigned To
                    </h3>
                    <div className="flex items-center gap-3">
                      {renderUserAvatar(assignedUserInfo)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {assignedUserInfo.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {assignedUserInfo.email}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Created Date */}
                {task.created_at && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Created
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(task.created_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <button
                  onClick={handleEdit}
                  disabled={actionLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Task
                </button>

                {confirmDelete ? (
                  <div className="flex gap-2 flex-1">
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {actionLoading ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={handleCancelDelete}
                      disabled={actionLoading}
                      className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Task Information */}
          <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l bg-gray-50">
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Task Information
              </h3>
              
              {/* Status Display */}
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  Current Status
                </h4>
                {renderStatusDisplay()}
              </div>

              {/* Quick Stats */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                  Task Details
                </h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Priority:</span>
                    <span className="font-medium">{priorityConfig.label}</span>
                  </div>
                  {task.created_at && (
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span className="font-medium">
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {task.updated_at && task.updated_at !== task.created_at && (
                    <div className="flex justify-between">
                      <span>Updated:</span>
                      <span className="font-medium">
                        {new Date(task.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}