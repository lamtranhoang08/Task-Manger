// client/src/components/workspace/QuickActions.jsx
import React from 'react';
import { Folder, Users, BarChart3 } from 'lucide-react';
import { Plus, UserPlus } from 'lucide-react';

const QuickActions = ({ onCreateProject, onInviteTeamMember, onCreateTask }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="space-y-3">
        <button
          onClick={onCreateProject}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Project</span>
        </button>

        <button
          onClick={onCreateTask}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Task</span>
        </button>

        <button
          onClick={onInviteTeamMember}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          <span>Invite Team Member</span>
        </button>
      </div>
    </div>
  );
};

export default QuickActions;