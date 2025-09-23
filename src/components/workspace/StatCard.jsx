import React from 'react';

const StatCard = ({ title, value, icon, trend, trendColor = 'text-green-600' }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {trend && (
          <p className={`text-xs font-medium ${trendColor} mt-1`}>
            {trend}
          </p>
        )}
      </div>
      <div className="p-3 bg-blue-100 rounded-lg">
        {icon}
      </div>
    </div>
  </div>
);

export default StatCard;