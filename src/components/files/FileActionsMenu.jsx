// src/components/files/FileActionsMenu.jsx
import React, { useState } from "react";
import {
  MoreVertical,
  Download,
  Trash2,
  Edit3,
  Eye,
  Copy,
  Share,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const FileActionsMenu = ({ file, onDelete, onUpdate, onDownload, onPreview }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = async (action) => {
    setIsOpen(false);

    switch (action) {
      case "download":
        onDownload?.(file);
        break;

      case "preview":
        onPreview?.(file);
        break;

      case "rename": {
        const newName = prompt("Enter new file name:", file.filename);
        if (newName && newName !== file.filename) {
          onUpdate?.({ ...file, filename: newName });
        }
        break;
      }

      case "delete": {
        if (window.confirm("Are you sure you want to delete this file?")) {
          onDelete?.(file.id);
        }
        break;
      }

      case "copy-link": {
        const { data } = supabase.storage
          .from("project-files")
          .getPublicUrl(file.file_path);

        if (data?.publicUrl) {
          await navigator.clipboard.writeText(data.publicUrl);
          alert("File link copied to clipboard!");
        }
        break;
      }

      default:
        break;
    }
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-500 hover:text-gray-700"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>

          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <button
              onClick={() => handleAction("preview")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>

            <button
              onClick={() => handleAction("download")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              onClick={() => handleAction("rename")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>Rename</span>
            </button>

            <button
              onClick={() => handleAction("copy-link")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Link</span>
            </button>

            <button
              onClick={() => handleAction("delete")}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FileActionsMenu;
