// src/components/TaskItem.jsx
import React, { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

export default function TaskItem({ task, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  if (!task) {
    return null;
  }

  const {
    id,
    title = "Untitled Task",
    description = "",
    status = "pending",
    priority = "medium",
    startTime,
    endTime,
    allDay = false,
  } = task;

  const fmt = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date)) return "Invalid date";
    return date.toLocaleString();
  };

  const handleDeleteClick = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    setDeleting(true);
    try {
      const success = await onDelete(id);
      if (!success) {
        // Reset confirmation state on failure
        setConfirmDelete(false);
      }
      // If successful, component will unmount so no need to reset state
    } catch (error) {
      console.error('Delete failed:', error);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(false);
  };

  return (
    <li className="p-4 border rounded-lg bg-white shadow-sm flex justify-between gap-3">
      <div className="flex-1">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-gray-600">{description || "No description"}</p>
        <p className="text-sm">Status: {status}</p>
        <p className="text-sm">Priority: {priority}</p>

        {!allDay && (
          <>
            <p className="text-sm">Start: {fmt(startTime)}</p>
            <p className="text-sm">End: {fmt(endTime)}</p>
          </>
        )}
        {allDay && <p className="text-sm text-blue-600">All Day</p>}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => onEdit(task)}
          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          disabled={deleting}
        >
          Toggle Status
        </button>
        
        {confirmDelete ? (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {deleting ? (
                <>
                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Confirm
                </>
              )}
            </button>
            <button
              onClick={handleCancelDelete}
              disabled={deleting}
              className="px-3 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleDeleteClick}
            disabled={deleting}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
      </div>
    </li>
  );
}