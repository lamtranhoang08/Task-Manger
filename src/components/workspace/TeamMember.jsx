// client/src/components/workspace/TeamMember.jsx
import React from 'react';

const TeamMember = ({ member }) => (
  <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
      <span className="text-white font-medium text-sm">
        {member.name.split(' ').map(n => n[0]).join('')}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
      <p className="text-xs text-gray-500 truncate">{member.role}</p>
    </div>
    <div className={`w-2 h-2 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
  </div>
);

export default TeamMember;