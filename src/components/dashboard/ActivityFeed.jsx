// src/components/dashboard/ActivityFeed.jsx - Modernized
import React from 'react';
import { 
  CheckCircle2, 
  Plus, 
  UserPlus, 
  Edit, 
  Calendar,
  Folder,
  Clock,
  Target,
  Users
} from 'lucide-react';

export default function ActivityFeed({ activities = [] }) {
  const getActivityConfig = (type) => {
    const configs = {
      task_completed: {
        icon: CheckCircle2,
        iconColor: 'text-green-600',
        iconBg: 'bg-green-100',
        action: 'completed',
        color: 'text-green-700'
      },
      task_created: {
        icon: Plus,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-100',
        action: 'created',
        color: 'text-blue-700'
      },
      task_assigned: {
        icon: UserPlus,
        iconColor: 'text-purple-600',
        iconBg: 'bg-purple-100',
        action: 'was assigned',
        color: 'text-purple-700'
      },
      task_updated: {
        icon: Edit,
        iconColor: 'text-amber-600',
        iconBg: 'bg-amber-100',
        action: 'updated',
        color: 'text-amber-700'
      },
      project_joined: {
        icon: Folder,
        iconColor: 'text-indigo-600',
        iconBg: 'bg-indigo-100',
        action: 'joined project',
        color: 'text-indigo-700'
      },
      project_created: {
        icon: Target,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-100',
        action: 'created project',
        color: 'text-emerald-700'
      }
    };
    return configs[type] || configs.task_updated;
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const groupActivitiesByDate = (activities) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
      today: [],
      yesterday: [],
      older: []
    };

    activities.forEach(activity => {
      const activityDate = new Date(activity.timestamp);
      const activityDateString = activityDate.toDateString();

      if (activityDateString === today.toDateString()) {
        groups.today.push(activity);
      } else if (activityDateString === yesterday.toDateString()) {
        groups.yesterday.push(activity);
      } else {
        groups.older.push(activity);
      }
    });

    return groups;
  };

  const ActivityItem = ({ activity, isLast = false }) => {
    const config = getActivityConfig(activity.type);
    const Icon = config.icon;

    return (
      <div className="relative">
        {/* Timeline line */}
        {!isLast && (
          <div className="absolute left-6 top-12 w-0.5 h-8 bg-gradient-to-b from-slate-200 to-transparent" />
        )}
        
        <div className="flex items-start gap-4 group">
          {/* Icon */}
          <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-6">
            <div className="flex items-start justify-between gap-2">
              {/* User Avatar & Info */}
              <div className="flex items-center gap-3 min-w-0">
                {activity.user_avatar ? (
                  <img
                    src={activity.user_avatar}
                    alt={activity.user_name}
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                    <span className="text-xs font-semibold text-slate-600">
                      {activity.user_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                
                <div className="min-w-0">
                  <p className="text-sm text-slate-900 leading-5">
                    <span className="font-semibold">{activity.user_name || 'Someone'}</span>
                    <span className={`ml-1 ${config.color}`}>{config.action}</span>
                    <span className="ml-1 font-medium text-slate-900 truncate">
                      {activity.title}
                    </span>
                  </p>
                  
                  {/* Project context */}
                  {activity.project_name && (
                    <div className="flex items-center gap-1 mt-1">
                      <Folder className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500 truncate">
                        {activity.project_name}
                      </span>
                    </div>
                  )}
                  
                  {/* Assignment context */}
                  {activity.metadata?.assigned_to && activity.type === 'task_assigned' && (
                    <div className="flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        to {activity.metadata.assigned_to}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div className="flex-shrink-0 text-xs text-slate-400">
                {formatTimeAgo(activity.timestamp)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ActivityGroup = ({ title, activities, icon: Icon }) => {
    if (activities.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Icon className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {title}
          </h4>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        
        <div className="space-y-1">
          {activities.map((activity, index) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              isLast={index === activities.length - 1}
            />
          ))}
        </div>
      </div>
    );
  };

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Activity Feed</h2>
              <p className="text-sm text-slate-500">Track your recent progress</p>
            </div>
          </div>

          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-900 mb-2">No recent activity</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start creating tasks and working on projects to see your activity here
            </p>
          </div>
        </div>
      </div>
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <p className="text-sm text-slate-500">Your latest updates and achievements</p>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="p-6 max-h-96 overflow-y-auto">
        <div className="space-y-6">
          <ActivityGroup
            title="Today"
            activities={groupedActivities.today}
            icon={Calendar}
          />
          
          <ActivityGroup
            title="Yesterday"
            activities={groupedActivities.yesterday}
            icon={Clock}
          />
          
          <ActivityGroup
            title="Earlier"
            activities={groupedActivities.older}
            icon={Target}
          />
        </div>

        {activities.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs text-center text-slate-400">
              Showing {activities.length} recent activities
            </p>
          </div>
        )}
      </div>
    </div>
  );
}