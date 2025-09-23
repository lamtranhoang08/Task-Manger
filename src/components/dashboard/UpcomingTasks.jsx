// src/components/dashboard/UpcomingTasks.jsx - Enhanced
import React from 'react';
import { Calendar, Clock, AlertCircle, CheckCircle2, Flag } from 'lucide-react';

export default function UpcomingTasks({ tasks = [] }) {
  const now = new Date();
  
  const upcomingTasks = tasks
    .filter(task => task.status !== 'completed' && task.due_date)
    .map(task => ({
      ...task,
      dueDate: new Date(task.due_date),
      isOverdue: new Date(task.due_date) < now,
      isToday: new Date(task.due_date).toDateString() === now.toDateString(),
      daysUntilDue: Math.ceil((new Date(task.due_date) - now) / (1000 * 60 * 60 * 24))
    }))
    .sort((a, b) => a.dueDate - b.dueDate)
    .slice(0, 6);

  const formatDueDate = (task) => {
    if (task.isOverdue) return { text: 'Overdue', color: 'text-red-600' };
    if (task.isToday) return { text: 'Due Today', color: 'text-amber-600' };
    if (task.daysUntilDue === 1) return { text: 'Due Tomorrow', color: 'text-blue-600' };
    if (task.daysUntilDue <= 7) return { text: `${task.daysUntilDue} days left`, color: 'text-slate-600' };
    
    return { 
      text: task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
      color: 'text-slate-500' 
    };
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      high: { color: 'text-red-600', bg: 'bg-red-100', dot: 'bg-red-500' },
      medium: { color: 'text-amber-600', bg: 'bg-amber-100', dot: 'bg-amber-500' },
      low: { color: 'text-green-600', bg: 'bg-green-100', dot: 'bg-green-500' }
    };
    return configs[priority] || configs.medium;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Upcoming Deadlines</h2>
            <p className="text-sm text-slate-500">Tasks that need your attention</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {upcomingTasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-2">All caught up!</h3>
            <p className="text-xs text-slate-500">No upcoming deadlines to worry about</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingTasks.map((task) => {
              const dueDateInfo = formatDueDate(task);
              const priorityConfig = getPriorityConfig(task.priority);
              
              return (
                <div 
                  key={task.id} 
                  className="group p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className="mt-0.5">
                      {task.isOverdue ? (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                      )}
                    </div>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {task.title}
                      </h4>
                      
                      <div className="flex items-center gap-3 mt-2">
                        {/* Due Date */}
                        <span className={`text-xs font-medium ${dueDateInfo.color}`}>
                          {dueDateInfo.text}
                        </span>
                        
                        {/* Priority */}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityConfig.bg} ${priorityConfig.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${priorityConfig.dot}`}></span>
                          {task.priority}
                        </span>
                        
                        {/* Project */}
                        {task.project_name && (
                          <span className="text-xs text-slate-500 truncate">
                            {task.project_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
