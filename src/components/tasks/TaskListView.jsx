// src/components/tasks/TaskListView.jsx - Modernized
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

export default function TaskListView({ tasks, onEdit, onDelete, onStatusChange }) {
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

  const handleStatusToggle = (task) => {
    const newStatus = task.displayStatus === 'complete' ? 'todo' : 
                     task.displayStatus === 'todo' ? 'progress' : 'complete';
    onStatusChange(task.id, { status: newStatus });
  };

  const ActionDropdown = ({ task, onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
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
                onClick={() => {
                  onEdit(task);
                  setIsOpen(false);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Edit className="w-4 h-4 mr-3 text-slate-400" />
                Edit Task
              </button>
              <button
                onClick={() => {
                  onDelete(task.id);
                  setIsOpen(false);
                }}
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
      <div className="text-center py-12">
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
            className={`group bg-white rounded-xl border transition-all duration-200 hover:shadow-md ${
              hoveredTask === task.id ? 'border-blue-200 shadow-sm' : 'border-slate-200'
            }`}
            onMouseEnter={() => setHoveredTask(task.id)}
            onMouseLeave={() => setHoveredTask(null)}
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                {/* Status Toggle */}
                <button
                  onClick={() => handleStatusToggle(task)}
                  className="mt-1 group-hover:scale-110 transition-transform"
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
                      className={`text-base font-semibold ${
                        task.displayStatus === 'complete' 
                          ? 'text-slate-500 line-through' 
                          : 'text-slate-900'
                      } cursor-pointer`}
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
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
                      <ActionDropdown 
                        task={task} 
                        onEdit={onEdit} 
                        onDelete={onDelete} 
                      />
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
                  <div className="flex items-center gap-4 text-xs text-slate-500">
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
                        <Folder className="w-3 h-3" />
                        {task.project_name}
                      </span>
                    )}

                    {/* Assigned User */}
                    {task.assigned_user_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.assigned_user_name}
                      </span>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && task.description && task.description.length > 100 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-600">{task.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}