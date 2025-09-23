// src/components/tasks/KanbanBoard.jsx
import React, { useState } from 'react';
import { User, Folder } from 'lucide-react';

const KanbanBoard = ({ tasks, onEdit, onDelete, onStatusChange }) => {
  const columns = [
    { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
    { id: 'progress', title: 'In Progress', color: 'bg-blue-100' },
    { id: 'complete', title: 'Completed', color: 'bg-green-100' }
  ];

  const [draggedTask, setDraggedTask] = useState(null);
  const [hoveredColumn, setHoveredColumn] = useState(null);

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';

    setTimeout(() => {
      if (e.currentTarget) e.currentTarget.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e) => {
    if (e.currentTarget) e.currentTarget.classList.remove('opacity-50');
    setDraggedTask(null);
    setHoveredColumn(null);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHoveredColumn(columnId);
  };

  const handleDragLeave = (e) => {
    setHoveredColumn(null);
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    setHoveredColumn(null);

    if (!draggedTask) return;

    if (draggedTask.displayStatus === targetColumnId) {
      setDraggedTask(null);
      return;
    }

    const statusMap = {
      todo: 'pending',
      progress: 'in-progress',
      complete: 'completed'
    };

    const backendStatus = statusMap[targetColumnId] || 'pending';

    if (typeof onStatusChange === 'function') {
      onStatusChange(draggedTask.id, { status: backendStatus });
    } else {
      console.warn('onStatusChange is not provided to KanbanBoard');
    }

    setDraggedTask(null);
  };

  const getColumnTasks = (columnId) => tasks.filter(t => t.displayStatus === columnId);

  const formatAssignee = (task) => {
    if (task.assigned_to_name) {
      return task.assigned_to_name;
    } else if (task.created_by_name) {
      return `${task.created_by_name} (Creator)`;
    }
    return 'Unassigned';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[600px]">
      {columns.map(column => {
        const columnTasks = getColumnTasks(column.id);
        const isDraggingOver = hoveredColumn === column.id && draggedTask && draggedTask.displayStatus !== column.id;

        return (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
            className={`p-4 rounded-lg ${column.color} transition-all duration-200 min-h-[200px]
              ${isDraggingOver ? 'ring-2 bg-yellow-100' : ''}`}
          >
            <h3 className="font-semibold mb-4 text-gray-800 sticky top-0 bg-inherit py-2">
              {column.title} ({columnTasks.length})
            </h3>

            <div className={`space-y-3 min-h-[100px] transition-all duration-200 ${isDraggingOver ? 'bg-blue-50 rounded-lg p-2' : ''}`}>
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  className="bg-white p-3 rounded shadow cursor-grab active:cursor-grabbing transition-transform hover:shadow-md border-l-4 border-l-gray-300"
                  style={{
                    borderLeftColor: task.project_id ? '#3B82F6' : '#6B7280' // Blue for project tasks, gray for personal
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm flex-1 pr-2">{task.title}</h4>
                    {task.priority && (
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                  )}

                  {/* Project and Assignment Info */}
                  <div className="space-y-2 mb-3">
                    {task.project_name && (
                      <div className="flex items-center space-x-1 text-xs">
                        <Folder className="w-3 h-3 text-blue-500" />
                        <span className="text-blue-600 font-medium truncate">{task.project_name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-1 text-xs">
                      <User className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-600 truncate">{formatAssignee(task)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                    <span>
                      Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                    </span>
                    {!task.project_id && (
                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">
                        Personal
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => onEdit && onEdit(task)}
                        className="text-blue-600 text-xs hover:text-blue-800 px-1 py-0.5 hover:bg-blue-50 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete && onDelete(task.id)}
                        className="text-red-600 text-xs hover:text-red-800 px-1 py-0.5 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="text-gray-400 text-xs cursor-grab select-none">⠿ Drag</div>
                  </div>
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {isDraggingOver ? 'Drop here' : 'No tasks'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;