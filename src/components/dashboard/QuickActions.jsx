
// src/components/dashboard/QuickActions.jsx - Enhanced  
import React from 'react';
import { Plus, Users, BarChart3, Calendar, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function QuickActions({ onTaskCreated }) {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'create-task',
      title: 'Create Task',
      description: 'Add a new task to your list',
      icon: Plus,
      color: 'from-blue-500 to-blue-600',
      onClick: () => navigate('/tasks', { state: { openAddModal: true } })
    },
    {
      id: 'view-workspace', 
      title: 'Workspace',
      description: 'Manage projects and teams',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      onClick: () => navigate('/workspace')
    },
    {
      id: 'view-analytics',
      title: 'Analytics', 
      description: 'View detailed reports',
      icon: BarChart3,
      color: 'from-green-500 to-green-600',
      onClick: () => console.log('Analytics coming soon!')
    },
    {
      id: 'schedule',
      title: 'Schedule',
      description: 'Plan your day',
      icon: Calendar,
      color: 'from-amber-500 to-amber-600', 
      onClick: () => console.log('Calendar coming soon!')
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <p className="text-sm text-slate-500">Get things done faster</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-left"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${action.color} flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}