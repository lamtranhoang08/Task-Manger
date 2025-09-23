// src/components/TaskItem.jsx
import React from "react";

export default function TaskItem({ task, onEdit, onDelete }) {
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
          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Toggle Status
        </button>
        <button
          onClick={() => onDelete(id)}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Delete
        </button>
      </div>
    </li>
  );
}