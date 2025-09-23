// src/components/TaskCard.jsx
import React, { useState } from "react";

export default function TaskCard({ task, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description);

  const handleDragStart = (e) => {
    e.dataTransfer.setData("taskId", task.id);
  };

  const handleSave = () => {
    onEdit(task.id, {
      title: editedTitle,
      description: editedDescription
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(task.title);
    setEditedDescription(task.description);
    setIsEditing(false);
  };

  const priorityColors = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-red-100 text-red-800"
  };

  const formatDate = (dateString) => {
    if (!dateString) return "No date";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).format(date);
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="bg-white rounded-lg shadow p-4 cursor-move"
    >
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
          <textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1"
          />
          <div className="flex justify-end space-x-2">
            <button 
              onClick={handleCancel}
              className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-2">
            <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[task.priority] || priorityColors.medium}`}>
              {task.priority}
            </span>
            <div className="flex space-x-1">
              <button 
                onClick={() => setIsEditing(true)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✏️
              </button>
              <button 
                onClick={() => onDelete(task.id)}
                className="text-gray-400 hover:text-red-600"
              >
                🗑️
              </button>
            </div>
          </div>
          
          <h3 className="font-medium text-gray-800 mb-2">{task.title}</h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatDate(task.dueDate)}</span>
            <div className="flex items-center space-x-2">
              <span>💬 {task.comments || 0}</span>
              <span>🔗 {task.links || 0}</span>
              <span className="flex items-center">
                👥 {task.assignees ? `${task.assignees.completed}/${task.assignees.total}` : "0/0"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}