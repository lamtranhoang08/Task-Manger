// src/components/tasks/TaskTableView.jsx - Updated with TaskDetailModal Integration
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
  Folder,
  ArrowUpDown,
  ChevronDown,
  Grid3X3
} from 'lucide-react';

export default function TaskTableView({ 
  tasks, 
  onEdit, 
  onDelete, 
  onStatusChange,
  onTaskClick,
  availableProjects = [],
  currentUser 
}) {
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case 'title':
        valueA = a.title?.toLowerCase() || '';
        valueB = b.title?.toLowerCase() || '';
        break;
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        valueA = priorityOrder[a.priority] || 0;
        valueB = priorityOrder[b.priority] || 0;
        break;
      case 'status':
        const statusOrder = { todo: 1, progress: 2, complete: 3 };
        valueA = statusOrder[a.displayStatus] || 0;
        valueB = statusOrder[b.displayStatus] || 0;
        break;
      case 'dueDate':
        valueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        valueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        break;
      default:
        valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
    }

    if (sortOrder === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });

  const getPriorityConfig = (priority) => {
    const configs = {
      high: { color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
      medium: { color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
      low: { color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' }
    };
    return configs[priority] || configs.medium;
  };

  const getStatusConfig = (status) => {
    const configs = {
      complete: { 
        color: 'text-green-700', 
        bg: 'bg-green-100', 
        icon: CheckCircle2,
        label: 'Done'
      },
      progress: { 
        color: 'text-blue-700', 
        bg: 'bg-blue-100', 
        icon: Clock,
        label: 'In Progress'
      },
      todo: { 
        color: 'text-slate-700', 
        bg: 'bg-slate-100', 
        icon: Circle,
        label: 'To Do'
      }
    };
    return configs[status] || configs.todo;
  };

  const formatDate = (dateString) => {
    if (!dateString) return { display: 'No date', isOverdue: false, isToday: false };
    
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now;
    const isToday = date.toDateString() === now.toDateString();
    
    let display;
    if (isToday) {
      display = 'Today';
    } else {
      display = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }

    return { display, isOverdue, isToday };
  };

  const handleStatusToggle = (task, event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const statusFlow = { todo: 'progress', progress: 'complete', complete: 'todo' };
    const newStatus = statusFlow[task.displayStatus];
    onStatusChange(task.id, { status: newStatus });
  };

  const handleRowClick = (task, event) => {
    // Don't trigger detail modal if clicking on action buttons or status toggle
    if (event.target.closest('.action-cell') || event.target.closest('.status-toggle')) {
      return;
    }

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
    const isOpen = openDropdown === task.id;

    const handleToggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpenDropdown(isOpen ? null : task.id);
    };

    const handleEdit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleEditClick(task, event);
      setOpenDropdown(null);
    };

    const handleDelete = (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleDeleteClick(task, event);
      setOpenDropdown(null);
    };

    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4 text-slate-400" />
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setOpenDropdown(null)}
            />
            <div className="absolute right-0 top-8 z-20 w-40 bg-white rounded-xl border border-slate-200 shadow-lg py-1">
              <button
                onClick={handleEdit}
                className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Edit className="w-4 h-4 mr-3 text-slate-400" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-3 text-red-400" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const SortHeader = ({ field, children, className = "" }) => (
    <th 
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown className="w-3 h-3 opacity-50" />
        {sortBy === field && (
          <ChevronDown className={`w-3 h-3 text-blue-600 ${sortOrder === 'asc' ? 'rotate-180' : ''} transition-transform`} />
        )}
      </div>
    </th>
  );

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Grid3X3 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No tasks found</h3>
          <p className="text-slate-500">Try adjusting your filters or create a new task.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-8 px-4 py-3 text-center">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</span>
              </th>
              <SortHeader field="title" className="min-w-[300px]">
                Task
              </SortHeader>
              <SortHeader field="status" className="w-32">
                Status
              </SortHeader>
              <SortHeader field="priority" className="w-24">
                Priority
              </SortHeader>
              <SortHeader field="dueDate" className="w-32">
                Due Date
              </SortHeader>
              <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Project
              </th>
              <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Assignee
              </th>
              <th className="w-16 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTasks.map((task, index) => {
              const priorityConfig = getPriorityConfig(task.priority);
              const statusConfig = getStatusConfig(task.displayStatus);
              const StatusIcon = statusConfig.icon;
              const dateInfo = formatDate(task.dueDate);

              return (
                <tr 
                  key={task.id} 
                  onClick={(e) => handleRowClick(task, e)}
                  className="group hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ '--row-index': index }}
                >
                  {/* Status Toggle */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={(e) => handleStatusToggle(task, e)}
                      className="group-hover:scale-110 transition-transform status-toggle"
                      title="Click to change status"
                    >
                      <StatusIcon 
                        className={`w-5 h-5 ${statusConfig.color} ${
                          task.displayStatus === 'complete' ? 'fill-current' : ''
                        }`} 
                      />
                    </button>
                  </td>

                  {/* Task Title & Description */}
                  <td className="px-4 py-4">
                    <div className="min-w-0">
                      <div className={`font-semibold text-slate-900 hover:text-blue-600 transition-colors ${
                        task.displayStatus === 'complete' ? 'line-through text-slate-500' : ''
                      }`}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-sm text-slate-500 mt-1 line-clamp-2">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityConfig.bg} ${priorityConfig.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${priorityConfig.dot}`}></span>
                      {task.priority}
                    </span>
                  </td>

                  {/* Due Date */}
                  <td className="px-4 py-4">
                    <div className={`text-sm flex items-center gap-1 ${
                      dateInfo.isOverdue && task.displayStatus !== 'complete' 
                        ? 'text-red-600 font-medium' 
                        : dateInfo.isToday 
                          ? 'text-blue-600 font-medium'
                          : 'text-slate-600'
                    }`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {dateInfo.display}
                      {dateInfo.isOverdue && task.displayStatus !== 'complete' && (
                        <AlertCircle className="w-3.5 h-3.5 ml-1" />
                      )}
                    </div>
                  </td>

                  {/* Project */}
                  <td className="px-4 py-4">
                    {task.project_name ? (
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Folder className="w-3.5 h-3.5 text-blue-500" />
                        <span className="truncate text-blue-600 font-medium">{task.project_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Personal</span>
                    )}
                  </td>

                  {/* Assignee */}
                  <td className="px-4 py-4">
                    {task.assigned_user_name ? (
                      <div className="flex items-center gap-2">
                        {task.assigned_user_avatar ? (
                          <img 
                            src={task.assigned_user_avatar} 
                            alt={task.assigned_user_name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-600">
                              {task.assigned_user_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-slate-600 truncate">
                          {task.assigned_user_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Unassigned</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 action-cell">
                    <ActionDropdown task={task} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Table Footer with Click Hint */}
      <div className="bg-slate-50 px-4 py-2 border-t border-slate-200">
        <div className="text-xs text-slate-500 text-center">
          Click any row to view task details • Click status icon to change status • Use action menu for edit/delete
        </div>
      </div>
    </div>
  );
}