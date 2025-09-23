// src/components/tasks/TaskBoard.jsx - Modernized
import React, { useState } from 'react';
import TaskModal from '../common/modal/TaskModal';
import TaskListView from './TaskListView';
import TaskTableView from './TaskTableView';
import KanbanBoard from './KanbanBoard';
import { Plus, Sparkles } from 'lucide-react';

export default function TaskBoard({ 
  tasks, 
  onDelete, 
  onEdit, 
  onAdd, 
  onStatusChange,
  viewMode, 
  isAddModalOpen, 
  onAddModalClose,
  onOpenAddModal
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const handleEditClick = (task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (updatedData) => {
    onEdit(editingTask.id, updatedData);
    setIsEditModalOpen(false);
    setEditingTask(null);
  };

  const handleStatusChange = (taskId, updatedData) => {
    onStatusChange(taskId, updatedData);
  };

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-6">
        <Sparkles className="w-12 h-12 text-blue-500" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">No tasks yet</h3>
      <p className="text-slate-600 text-center max-w-md mb-6">
        Get started by creating your first task. Stay organized and boost your productivity.
      </p>
      <button
        onClick={onOpenAddModal}
        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
      >
        <Plus className="w-5 h-5 mr-2" />
        Create Your First Task
      </button>
    </div>
  );

  return (
    <div className="relative">
      {/* Render appropriate view */}
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {viewMode === 'board' && (
            <KanbanBoard
              tasks={tasks}
              onEdit={handleEditClick}
              onDelete={onDelete}
              onStatusChange={handleStatusChange}
            />
          )}

          {viewMode === 'list' && (
            <TaskListView
              tasks={tasks}
              onEdit={handleEditClick}
              onDelete={onDelete}
            />
          )}

          {viewMode === 'table' && (
            <TaskTableView
              tasks={tasks}
              onEdit={handleEditClick}
              onDelete={onDelete}
            />
          )}
        </>
      )}

      {/* Floating Action Button - Modern design */}
      {tasks.length > 0 && (
        <button
          onClick={onOpenAddModal}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center group z-50"
          aria-label="Add new task"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
        </button>
      )}

      {/* Add Task Modal */}
      <TaskModal
        open={isAddModalOpen}
        onClose={onAddModalClose}
        onSubmit={onAdd}
        initialData={null}
        isEditing={false}
      />

      {/* Edit Task Modal */}
      <TaskModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        initialData={editingTask}
        isEditing={true}
      />
    </div>
  );
}