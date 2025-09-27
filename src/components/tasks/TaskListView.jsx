// src/components/tasks/TaskListView.jsx - Updated with TaskDetailModal Integration
import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Flag, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  CheckCircle2,
  Circle,
  AlertCircle,
  Folder
} from 'lucide-react';

export default function TaskListView({ 
  tasks, 
  onEdit, 
  onDelete, 
  onStatusChange,
  onTaskClick,
  availableProjects = [],
  currentUser 
}) {
  const [expandedTask, setExpandedTask] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);

  const getPriorityConfig = (priority) => {
    const configs = {
      high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: '🔴' },
      medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: '🟡' },
      low: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: '🟢' }
    };
    return configs[priority] || configs.medium;
  };

  const getStatusConfig = (status) => {
    const configs = {
      complete: { 
        color: 'text-green-600', 
        bg: 'bg-green-50', 
        border: 'border-green-200', 
        icon: CheckCircle2,
        label: 'Completed'
      },
      progress: { 
        color: 'text-blue-600', 
        bg: 'bg-blue-50', 
        border: 'border-blue-200', 
        icon: Clock,
        label: 'In Progress'
      },
      todo: { 
        color: 'text-slate-600', 
        bg: 'bg-slate-50', 
        border: 'border-slate-200', 
        icon: Circle,
        label: 'To Do'
      }
    };
    return configs[status] || configs.todo;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now;
    const isToday = date.toDateString() === now.toDateString();
    
    let formattedDate;
    if (isToday) {
      formattedDate = 'Today';
    } else {
      formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }

    return { formattedDate, isOverdue, isToday };
  };

  const handleStatusToggle = (task, event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const newStatus = task.displayStatus === 'complete' ? 'todo' : 
                     task.displayStatus === 'todo' ? 'progress' : 'complete';
    onStatusChange(task.id, { status: newStatus });
  };

  const handleTaskClick = (task, event) => {
    // Don't trigger detail modal if clicking on expandable content or action buttons
    if (event.target.closest('.action-button') || event.target.closest('.status-toggle')) {
      return;
    }

    // Handle expand/collapse for title clicks
    if (event.target.closest('.task-title')) {
      setExpandedTask(expandedTask === task.id ? null : task.id);
      return;
    }

    // Trigger detail modal for main task area clicks
    if (onTaskClick && !event.defaultPrevented) {
      onTaskClick(task, event);
    }
  };

  const handleEditClick = (task, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (onEdit) {
      onEdit(task, event);
    }
  };

  const handleDeleteClick = (task, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (onDelete) {
      onDelete(task.id, event);
    }
  };

  const ActionDropdown = ({ task }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(!isOpen);
    };

    const handleEdit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleEditClick(task, event);
      setIsOpen(false);
    };

    const handleDelete = (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleDeleteClick(task, event);
      setIsOpen(false);
    };

    return (
      <div className="relative action-button">
        <button
          onClick={handleToggle}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4 text-slate-400" />
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-xl border border-slate-200 shadow-lg py-1">
              <button
                onClick={handleEdit}
                className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Edit className="w-4 h-4 mr-3 text-slate-400" />
                Edit Task
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-3 text-red-400" />
                Delete Task
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">No tasks found</h3>
        <p className="text-slate-500">Try adjusting your filters or create a new task.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const priorityConfig = getPriorityConfig(task.priority);
        const statusConfig = getStatusConfig(task.displayStatus);
        const StatusIcon = statusConfig.icon;
        const dateInfo = formatDate(task.dueDate);
        const isExpanded = expandedTask === task.id;

        return (
          <div
            key={task.id}
            className={`group bg-white rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer ${
              hoveredTask === task.id ? 'border-blue-200 shadow-sm' : 'border-slate-200'
            }`}
            onClick={(e) => handleTaskClick(task, e)}
            onMouseEnter={() => setHoveredTask(task.id)}
            onMouseLeave={() => setHoveredTask(null)}
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                {/* Status Toggle */}
                <button
                  onClick={(e) => handleStatusToggle(task, e)}
                  className="mt-1 group-hover:scale-110 transition-transform status-toggle"
                >
                  <StatusIcon 
                    className={`w-5 h-5 ${statusConfig.color} ${
                      task.displayStatus === 'complete' ? 'fill-current' : ''
                    }`} 
                  />
                </button>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  {/* Title and Priority */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 
                      className={`text-base font-semibold task-title ${
                        task.displayStatus === 'complete' 
                          ? 'text-slate-500 line-through' 
                          : 'text-slate-900 hover:text-blue-600'
                      } cursor-pointer transition-colors`}
                      title="Click to expand/collapse or click elsewhere to view details"
                    >
                      {task.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Priority Badge */}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priorityConfig.bg} ${priorityConfig.color} ${priorityConfig.border}`}>
                        <span className="mr-1">{priorityConfig.icon}</span>
                        {task.priority}
                      </span>
                      
                      {/* Action Menu */}
                      <ActionDropdown task={task} />
                    </div>
                  </div>

                  {/* Description */}
                  {task.description && (
                    <p className={`text-sm mb-3 ${
                      task.displayStatus === 'complete' ? 'text-slate-400' : 'text-slate-600'
                    } ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {task.description}
                    </p>
                  )}

                  {/* Metadata Row */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2 py-1 rounded-md ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}>
                      {statusConfig.label}
                    </span>

                    {/* Due Date */}
                    {dateInfo && (
                      <span className={`flex items-center gap-1 ${
                        dateInfo.isOverdue && task.displayStatus !== 'complete' 
                          ? 'text-red-600 font-medium' 
                          : dateInfo.isToday 
                            ? 'text-blue-600 font-medium'
                            : ''
                      }`}>
                        <Calendar className="w-3 h-3" />
                        {dateInfo.formattedDate}
                        {dateInfo.isOverdue && task.displayStatus !== 'complete' && (
                          <AlertCircle className="w-3 h-3 ml-1" />
                        )}
                      </span>
                    )}

                    {/* Project */}
                    {task.project_name && (
                      <span className="flex items-center gap-1">
                        <Folder className="w-3 h-3 text-blue-500" />
                        <span className="text-blue-600 font-medium">{task.project_name}</span>
                      </span>
                    )}

                    {/* Assigned User */}
                    {task.assigned_user_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.assigned_user_name}
                      </span>
                    )}

                    {/* Personal Task Indicator */}
                    {!task.project_id && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs">
                        Personal
                      </span>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && task.description && task.description.length > 100 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{task.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Click hint */}
            <div className="px-5 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-xs text-slate-400 text-center border-t pt-2">
                Click anywhere to view details • Click title to expand • Click status to change
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}