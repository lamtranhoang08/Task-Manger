// src/components/tasks/TaskBoard.jsx - Updated with TaskDetailModal Integration
import React, { useState } from 'react';
import TaskModal from '../common/modal/TaskModal';
import TaskListView from './TaskListView';
import TaskTableView from './TaskTableView';
import KanbanBoard from './KanbanBoard';
import { Plus, Sparkles } from 'lucide-react';

/**
 * TaskBoard - Main task management component with multiple view modes
 * 
 * @param {Object} props
 * @param {Array} props.tasks - Array of task objects
 * @param {Function} props.onDelete - Delete task handler
 * @param {Function} props.onEdit - Edit task handler
 * @param {Function} props.onAdd - Add task handler
 * @param {Function} props.onStatusChange - Status change handler
 * @param {Function} props.onTaskClick - Task click handler for detail modal
 * @param {string} props.viewMode - Current view mode (board, list, table)
 * @param {boolean} props.isAddModalOpen - Add modal open state
 * @param {Function} props.onAddModalClose - Add modal close handler
 * @param {Function} props.onOpenAddModal - Add modal open handler
 * @param {Array} props.availableProjects - Available projects for context
 * @param {Object} props.currentUser - Current user data
 */
export default function TaskBoard({ 
  tasks, 
  onDelete, 
  onEdit, 
  onAdd, 
  onStatusChange,
  onTaskClick, // New prop for task detail modal
  viewMode, 
  isAddModalOpen, 
  onAddModalClose,
  onOpenAddModal,
  availableProjects = [], // New prop
  currentUser // New prop
}) {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle edit button click (separate from task click for detail view)
   */
  const handleEditClick = (task, event) => {
    // Prevent event bubbling to avoid triggering task detail modal
    if (event) {
      event.stopPropagation();
    }
    
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  /**
   * Handle edit form submission
   */
  const handleEditSubmit = (updatedData) => {
    if (editingTask && onEdit) {
      onEdit(editingTask.id, updatedData);
    }
    setIsEditModalOpen(false);
    setEditingTask(null);
  };

  /**
   * Handle status change with proper data formatting
   */
  const handleStatusChange = (taskId, updatedData) => {
    if (onStatusChange) {
      onStatusChange(taskId, updatedData);
    }
  };

  /**
   * Handle task item click for detail modal
   */
  const handleTaskClick = (task, event) => {
    // Only trigger if onTaskClick is provided and it's not an action button click
    if (onTaskClick && !event?.defaultPrevented) {
      onTaskClick(task);
    }
  };

  /**
   * Handle delete with event propagation control
   */
  const handleDelete = (taskId, event) => {
    // Prevent event bubbling to avoid triggering task detail modal
    if (event) {
      event.stopPropagation();
    }
    
    if (onDelete) {
      onDelete(taskId);
    }
  };

  // ========================================================================
  // RENDER COMPONENTS
  // ========================================================================

  /**
   * Empty state component with modern design
   */
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200">
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

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="relative">
      {/* Render appropriate view based on mode */}
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {viewMode === 'board' && (
            <KanbanBoard
              tasks={tasks}
              onEdit={handleEditClick}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onTaskClick={handleTaskClick}
              availableProjects={availableProjects}
              currentUser={currentUser}
            />
          )}

          {viewMode === 'list' && (
            <TaskListView
              tasks={tasks}
              onEdit={handleEditClick}
              onDelete={handleDelete}
              onTaskClick={handleTaskClick}
              availableProjects={availableProjects}
              currentUser={currentUser}
            />
          )}

          {viewMode === 'table' && (
            <TaskTableView
              tasks={tasks}
              onEdit={handleEditClick}
              onDelete={handleDelete}
              onTaskClick={handleTaskClick}
              availableProjects={availableProjects}
              currentUser={currentUser}
            />
          )}
        </>
      )}

      {/* Modern Floating Action Button */}
      {tasks.length > 0 && (
        <button
          onClick={onOpenAddModal}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center group z-40"
          aria-label="Add new task"
          title="Add new task (Ctrl+N)"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
        </button>
      )}

      {/* Task Creation Modal */}
      <TaskModal
        open={isAddModalOpen}
        onClose={onAddModalClose}
        onSubmit={onAdd}
        initialData={null}
        isEditing={false}
        allowProjectSelection={true}
        availableProjects={availableProjects}
        currentUser={currentUser}
      />

      {/* Task Edit Modal */}
      <TaskModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleEditSubmit}
        initialData={editingTask}
        isEditing={true}
        allowProjectSelection={true}
        availableProjects={availableProjects}
        currentUser={currentUser}
      />
    </div>
  );
}