// src/components/dashboard/TaskChart.jsx - Enhanced
import React from 'react';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';

export default function TaskChart({ tasks = [], timeRange = 'week' }) {
  const statusData = {
    pending: tasks.filter(t => t.status === 'pending').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  const priorityData = {
    low: tasks.filter(t => t.priority === 'low').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    high: tasks.filter(t => t.priority === 'high').length
  };

  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((statusData.completed / totalTasks) * 100) : 0;

  const ChartBar = ({ label, value, total, color, bgColor }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700 capitalize">{label.replace('-', ' ')}</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{value}</span>
            <span className="text-xs text-slate-400">({percentage.toFixed(0)}%)</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Task Analytics</h2>
              <p className="text-sm text-slate-500">Performance overview for the {timeRange}</p>
            </div>
          </div>
          
          {/* Completion Rate Badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">{completionRate}% complete</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Status Chart */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-900">By Status</h3>
            </div>
            <div className="space-y-4">
              <ChartBar 
                label="Completed" 
                value={statusData.completed} 
                total={totalTasks} 
                color="bg-gradient-to-r from-green-400 to-green-500"
              />
              <ChartBar 
                label="In Progress" 
                value={statusData['in-progress']} 
                total={totalTasks} 
                color="bg-gradient-to-r from-blue-400 to-blue-500"
              />
              <ChartBar 
                label="Pending" 
                value={statusData.pending} 
                total={totalTasks} 
                color="bg-gradient-to-r from-slate-300 to-slate-400"
              />
            </div>
          </div>

          {/* Priority Chart */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-900">By Priority</h3>
            </div>
            <div className="space-y-4">
              <ChartBar 
                label="High Priority" 
                value={priorityData.high} 
                total={totalTasks} 
                color="bg-gradient-to-r from-red-400 to-red-500"
              />
              <ChartBar 
                label="Medium Priority" 
                value={priorityData.medium} 
                total={totalTasks} 
                color="bg-gradient-to-r from-amber-400 to-amber-500"
              />
              <ChartBar 
                label="Low Priority" 
                value={priorityData.low} 
                total={totalTasks} 
                color="bg-gradient-to-r from-green-400 to-green-500"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {totalTasks > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{totalTasks}</div>
                <div className="text-xs text-slate-500 font-medium">Total Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statusData.completed}</div>
                <div className="text-xs text-slate-500 font-medium">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statusData['in-progress']}</div>
                <div className="text-xs text-slate-500 font-medium">Active</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}