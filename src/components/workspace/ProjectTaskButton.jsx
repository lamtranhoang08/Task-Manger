// src/components/workspace/ProjectTaskButton.jsx
import React, { useState } from 'react'; // Change this line
import { Plus } from 'lucide-react';
import TaskModal from '../common/modal/TaskModal';

const ProjectTaskButton = ({ projectId, onTaskCreated }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const handleTaskSubmit = async (taskData) => {
        if (onTaskCreated) {
            onTaskCreated(taskData);
        }
        setIsModalOpen(false);
    };
    return (
        <>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
    
          <TaskModal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleTaskSubmit}
            preselectedProjectId={projectId}
            allowProjectSelection={false}
            isEditing={false}
          />
        </>
      );
    };

export default ProjectTaskButton;