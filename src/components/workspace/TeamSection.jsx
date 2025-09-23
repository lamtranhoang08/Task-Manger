// client/src/components/workspace/TeamSection.jsx
import React from 'react';
import TeamMember from './TeamMember';

const TeamSection = ({ teamMembers }) => (
  <div className="space-y-6">
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
        <button className="text-blue-600 text-sm font-medium hover:text-blue-800">
          Manage →
        </button>
      </div>
      <div className="space-y-2">
        {teamMembers.map(member => (
          <TeamMember key={member.id} member={member} />
        ))}
      </div>
    </div>
  </div>
);

export default TeamSection;