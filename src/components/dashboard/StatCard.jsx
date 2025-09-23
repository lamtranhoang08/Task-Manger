
// src/components/dashboard/StatCard.jsx - Enhanced
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon, color = 'blue', trend, trendColor }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50',
    green: 'from-green-500 to-green-600 text-green-600 bg-green-50',
    red: 'from-red-500 to-red-600 text-red-600 bg-red-50',
    amber: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50',
    purple: 'from-purple-500 to-purple-600 text-purple-600 bg-purple-50',
    slate: 'from-slate-500 to-slate-600 text-slate-600 bg-slate-50'
  };

  const colors = colorClasses[color] || colorClasses.blue;
  const [gradientColors, textColor, bgColor] = colors.split(' ');

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${gradientColors} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
          <div className="text-white">
            {icon}
          </div>
        </div>
        
        {trend && (
          <div className={`text-xs font-medium ${trendColor || 'text-slate-500'} flex items-center gap-1`}>
            {trend.includes('+') ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend.includes('-') ? (
              <TrendingDown className="w-3 h-3" />
            ) : null}
            <span className="hidden sm:inline">{trend}</span>
          </div>
        )}
      </div>

      <div>
        <div className="text-2xl font-bold text-slate-900 mb-1 group-hover:scale-105 transition-transform origin-left">
          {value}
        </div>
        <div className="text-sm font-medium text-slate-500">
          {title}
        </div>
      </div>
    </div>
  );
}
