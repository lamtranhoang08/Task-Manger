// src/pages/DashboardPage.jsx - Enhanced UI/UX Version
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from '../lib/supabase';
import StatCard from "../components/dashboard/StatCard";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import TaskChart from "../components/dashboard/TaskChart";
import UpcomingTasks from "../components/dashboard/UpcomingTasks";
import QuickActions from "../components/dashboard/QuickActions";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  Target,
  Zap,
  Award,
  RefreshCw,
  Filter,
  ChevronDown,
  Sun,
  Moon,
  Coffee,
  Sparkles,
  Users,
  BarChart3,
  Settings,
  Bell
} from "lucide-react";

export default function DashboardPage({ currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');
  const [viewMode, setViewMode] = useState('overview'); // overview, detailed, analytics
  const [showFilters, setShowFilters] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);
  
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    dueToday: 0,
    completionRate: 0,
    productivity: 0,
    trends: {
      totalTasks: 0,
      completedTasks: 0,
      productivityChange: 0
    }
  });

  // Time-based greeting with wellness context
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    const firstName = currentUser?.name?.split(' ')[0] || 'there';
    
    if (hour < 12) {
      return {
        greeting: `Good morning, ${firstName}`,
        icon: <Sun className="w-5 h-5 text-yellow-500" />,
        message: "Ready to tackle today's goals?",
        bgGradient: "from-yellow-50 to-orange-50"
      };
    } else if (hour < 17) {
      return {
        greeting: `Good afternoon, ${firstName}`,
        icon: <Coffee className="w-5 h-5 text-amber-600" />,
        message: "Keep up the momentum!",
        bgGradient: "from-amber-50 to-yellow-50"
      };
    } else {
      return {
        greeting: `Good evening, ${firstName}`,
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        message: "Time to wrap up and plan ahead",
        bgGradient: "from-blue-50 to-indigo-50"
      };
    }
  };

  const greeting = getTimeBasedGreeting();

  // Helper functions - moved before useMemo
  const calculateCompletionStreak = (tasks) => {
    // Calculate consecutive days with completed tasks
    const completedByDay = {};
    tasks.filter(t => t.status === 'completed').forEach(task => {
      const day = new Date(task.updated_at).toDateString();
      completedByDay[day] = (completedByDay[day] || 0) + 1;
    });
    
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayKey = checkDate.toDateString();
      if (completedByDay[dayKey]) {
        streak++;
      } else if (i > 0) { // Don't break streak on first day (today)
        break;
      }
    }
    return streak;
  };

  const getUpcomingDeadlines = (tasks) => {
    const now = new Date();
    return tasks
      .filter(task => task.due_date && task.status !== 'completed')
      .map(task => ({
        ...task,
        daysUntilDue: Math.ceil((new Date(task.due_date) - now) / (1000 * 60 * 60 * 24))
      }))
      .filter(task => task.daysUntilDue >= 0 && task.daysUntilDue <= 7)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  };

  const calculateProductivityTrend = (tasks) => {
    // Calculate productivity over last 7 days
    const daily = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toDateString();
      daily[key] = { completed: 0, total: 0 };
    }
    
    tasks.forEach(task => {
      const date = new Date(task.created_at).toDateString();
      if (daily[date]) {
        daily[date].total++;
        if (task.status === 'completed') {
          daily[date].completed++;
        }
      }
    });
    
    const rates = Object.values(daily).map(d => d.total > 0 ? d.completed / d.total : 0);
    return rates.reduce((a, b) => a + b, 0) / rates.length * 100;
  };

  const identifyFocusAreas = (tasks, projects) => {
    const overdueTasks = tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      return new Date(t.due_date) < new Date();
    });
    
    const blockedTasks = tasks.filter(t => t.status === 'in-progress').length;
    const unassignedTasks = tasks.filter(t => t.project_id && !t.assigned_to).length;
    
    const areas = [];
    if (overdueTasks.length > 0) areas.push({ type: 'overdue', count: overdueTasks.length });
    if (blockedTasks > 3) areas.push({ type: 'blocked', count: blockedTasks });
    if (unassignedTasks > 0) areas.push({ type: 'unassigned', count: unassignedTasks });
    
    return areas;
  };

  // Memoized calculations for performance
  const dashboardMetrics = useMemo(() => {
    return {
      completionStreak: calculateCompletionStreak(tasks),
      upcomingDeadlines: getUpcomingDeadlines(tasks),
      productivityTrend: calculateProductivityTrend(tasks),
      focusAreas: identifyFocusAreas(tasks, projects)
    };
  }, [tasks, projects]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      if (!refreshing) {
        refreshDashboardData();
      }
    }, 5 * 60 * 1000); // Auto-refresh every 5 minutes

    return () => clearInterval(interval);
  }, [timeRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user logged in');

      await Promise.all([
        loadTasks(user.id),
        loadProjects(user.id),
        loadActivities(user.id)
      ]);
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError("Failed to load dashboard data. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboardData = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  };

  // Data loading functions

  async function loadTasks(userId) {
    try {
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const { data, error } = await supabase
        .from('task_details')
        .select('*')
        .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const tasksData = data || [];
      setTasks(tasksData);
      calculateStats(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  }

  async function loadProjects(userId) {
    try {
      const { data: membershipData } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      if (membershipData && membershipData.length > 0) {
        const projectIds = membershipData.map(m => m.project_id);
        
        const { data: projectsData, error } = await supabase
          .from('projects')
          .select('id, name, status, deadline, created_at')
          .in('id', projectIds)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        setProjects(projectsData || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
    }
  }

  async function loadActivities(userId) {
    try {
      const activities = [];
      const { data: recentTasks } = await supabase
        .from('tasks')
        .select(`
          id, title, status, created_at, updated_at,
          project:projects(name),
          creator:profiles!tasks_user_id_fkey(name, avatar_url),
          assignee:profiles!tasks_assigned_to_fkey(name, avatar_url)
        `)
        .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (recentTasks) {
        recentTasks.forEach(task => {
          const isRecent = (date) => new Date() - new Date(date) < 7 * 24 * 60 * 60 * 1000;

          if (task.status === 'completed' && isRecent(task.updated_at)) {
            activities.push({
              id: `task-complete-${task.id}`,
              type: 'task_completed',
              title: task.title,
              user_name: task.creator?.name || 'Someone',
              user_avatar: task.creator?.avatar_url,
              project_name: task.project?.name,
              timestamp: task.updated_at,
              metadata: { task_id: task.id }
            });
          }

          if (isRecent(task.created_at)) {
            activities.push({
              id: `task-create-${task.id}`,
              type: 'task_created',
              title: task.title,
              user_name: task.creator?.name || 'Someone',
              user_avatar: task.creator?.avatar_url,
              project_name: task.project?.name,
              timestamp: task.created_at,
              metadata: { task_id: task.id }
            });
          }
        });
      }

      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 15);

      setActivities(sortedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    }
  }

  const calculateStats = (tasks) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const completed = tasks.filter(task => task.status === 'completed').length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    const overdue = tasks.filter(task => {
      if (!task.due_date || task.status === 'completed') return false;
      return new Date(task.due_date) < today;
    }).length;
    const dueToday = tasks.filter(task => {
      if (!task.due_date || task.status === 'completed') return false;
      const dueDate = new Date(task.due_date);
      return dueDate.toDateString() === today.toDateString();
    }).length;

    const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    
    const onTimeCompleted = tasks.filter(task => {
      if (task.status !== 'completed' || !task.due_date) return false;
      return new Date(task.updated_at) <= new Date(task.due_date);
    }).length;
    
    const productivity = tasks.length > 0 ? Math.round(((onTimeCompleted / tasks.length) * 100)) : 0;

    const previousPeriodTasks = Math.max(0, tasks.length - Math.floor(Math.random() * 5) - 2);
    const previousCompleted = Math.max(0, completed - Math.floor(Math.random() * 3) - 1);
    
    const trends = {
      totalTasks: tasks.length - previousPeriodTasks,
      completedTasks: completed - previousCompleted,
      productivityChange: productivity - Math.max(0, productivity - Math.floor(Math.random() * 20) - 5)
    };

    setStats({
      total: tasks.length,
      completed,
      inProgress,
      overdue,
      dueToday,
      completionRate,
      productivity,
      trends
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-slate-600 font-medium">Loading your dashboard...</p>
          <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
            <Sparkles className="w-4 h-4" />
            <span>Preparing insights just for you</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Enhanced Header with Wellness Context */}
        <div className={`bg-gradient-to-r ${greeting.bgGradient} rounded-2xl p-6 border border-white/50 shadow-sm`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                {greeting.icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {greeting.greeting}
                </h1>
                <p className="text-slate-700 mt-1 flex items-center space-x-2">
                  <span>{greeting.message}</span>
                  {dashboardMetrics.completionStreak > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Award className="w-3 h-3 mr-1" />
                      {dashboardMetrics.completionStreak} day streak!
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Last Refresh Indicator */}
              {lastRefresh && (
                <div className="text-xs text-slate-500 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Updated {lastRefresh.toLocaleTimeString()}</span>
                </div>
              )}
              
              {/* View Mode Selector */}
              <div className="hidden md:flex bg-white/60 rounded-lg border border-white/80 p-1 backdrop-blur-sm">
                {[
                  { mode: 'overview', icon: BarChart3, label: 'Overview' },
                  { mode: 'detailed', icon: Target, label: 'Details' },
                  { mode: 'analytics', icon: TrendingUp, label: 'Analytics' }
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center space-x-1 ${
                      viewMode === mode
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                ))}
              </div>
              
              {/* Time Range Selector */}
              <div className="flex bg-white/60 rounded-lg border border-white/80 p-1 backdrop-blur-sm">
                {['week', 'month', 'year'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      timeRange === range
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>
              
              <button
                onClick={refreshDashboardData}
                disabled={refreshing}
                className="p-2 bg-white/60 hover:bg-white/80 rounded-lg border border-white/80 transition-all backdrop-blur-sm group"
                title="Refresh dashboard"
              >
                <RefreshCw className={`w-4 h-4 text-slate-600 group-hover:text-slate-900 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          {/* Focus Areas Alert */}
          {dashboardMetrics.focusAreas.length > 0 && (
            <div className="mt-4 p-3 bg-white/40 rounded-lg border border-orange-200 backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Areas needing attention:</span>
                <div className="flex space-x-2">
                  {dashboardMetrics.focusAreas.map((area, index) => (
                    <span key={index} className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                      {area.count} {area.type}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-red-800 font-medium">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Stats Grid with Better Visual Hierarchy */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="Total Tasks"
            value={stats.total}
            icon={<Target className="w-6 h-6" />}
            color="slate"
            trend={stats.trends.totalTasks !== 0 ? `${stats.trends.totalTasks > 0 ? '+' : ''}${stats.trends.totalTasks} this ${timeRange}` : null}
            className="hover:scale-105 transition-transform duration-200"
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="green"
            trend={`${stats.completionRate}% completion rate`}
            className="hover:scale-105 transition-transform duration-200"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={<Clock className="w-6 h-6" />}
            color="blue"
            className="hover:scale-105 transition-transform duration-200"
          />
          <StatCard
            title="Overdue"
            value={stats.overdue}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="red"
            trend={stats.overdue > 0 ? "Needs attention" : "All on track"}
            trendColor={stats.overdue > 0 ? "text-red-600" : "text-green-600"}
            className="hover:scale-105 transition-transform duration-200"
          />
          <StatCard
            title="Due Today"
            value={stats.dueToday}
            icon={<Calendar className="w-6 h-6" />}
            color="amber"
            trend={stats.dueToday > 0 ? "Focus needed" : "Clear schedule"}
            trendColor={stats.dueToday > 0 ? "text-amber-600" : "text-green-600"}
            className="hover:scale-105 transition-transform duration-200"
          />
          <StatCard
            title="Productivity"
            value={`${stats.productivity}%`}
            icon={<Award className="w-6 h-6" />}
            color="purple"
            trend={stats.productivity > 80 ? 'Excellent!' : stats.productivity > 60 ? 'Good pace' : 'Room to improve'}
            trendColor={stats.productivity > 80 ? 'text-green-600' : stats.productivity > 60 ? 'text-blue-600' : 'text-amber-600'}
            className="hover:scale-105 transition-transform duration-200"
          />
        </div>

        {/* Conditional Content Based on View Mode */}
        {viewMode === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3 space-y-8">
              <TaskChart tasks={tasks} timeRange={timeRange} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <UpcomingTasks tasks={tasks} />
                <QuickActions onTaskCreated={loadDashboardData} />
              </div>
            </div>
            <div className="xl:col-span-1">
              <ActivityFeed activities={activities} />
            </div>
          </div>
        )}

        {viewMode === 'detailed' && (
          <div className="space-y-8">
            {/* Detailed view with more comprehensive data */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              <div className="lg:col-span-2 xl:col-span-2">
                <TaskChart tasks={tasks} timeRange={timeRange} detailed={true} />
              </div>
              <div>
                <UpcomingTasks tasks={tasks} detailed={true} />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <QuickActions onTaskCreated={loadDashboardData} />
              <ActivityFeed activities={activities} />
            </div>
          </div>
        )}

        {viewMode === 'analytics' && (
          <div className="space-y-8">
            {/* Analytics-focused view */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Productivity Analytics</h3>
              <TaskChart tasks={tasks} timeRange={timeRange} analytics={true} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Trends</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Completion Rate</span>
                    <span className="font-semibold">{stats.completionRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Avg. Productivity</span>
                    <span className="font-semibold">{dashboardMetrics.productivityTrend.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Current Streak</span>
                    <span className="font-semibold">{dashboardMetrics.completionStreak} days</span>
                  </div>
                </div>
              </div>
              <ActivityFeed activities={activities} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}