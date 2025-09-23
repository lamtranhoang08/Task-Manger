// src/components/TaskColumn.jsx
import React from "react";
import TaskCard from "./TaskCard";

export default function TaskColumn({ title, tasks, status, color, onStatusChange, onEdit, onDelete }) {
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    onStatusChange(taskId, status);
  };

  return (
    <div 
      className="flex-1 min-w-64 bg-gray-100 rounded-lg p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700">{title}</h2>
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${color}`}>
          {tasks.length}
        </span>
      </div>
      
      <div className="space-y-3">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        
        {tasks.length === 0 && (
          <div className="text-center text-gray-400 py-4">
            No tasks in this column
          </div>
        )}
      </div>
    </div>
  );
}