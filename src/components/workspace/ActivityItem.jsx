import React from 'react';

const ActivityItem = ({ activity }) => (
  <div className="flex space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
      <activity.icon className="w-4 h-4 text-blue-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-900">
        <span className="font-medium">{activity.user}</span> {activity.action}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {new Date(activity.timestamp).toLocaleString()}
      </p>
    </div>
  </div>
);

export default ActivityItem;