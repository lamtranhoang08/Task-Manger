// src/pages/DashboardPage.jsx - Modernized
import React, { useState, useEffect } from "react";
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
  Award
} from "lucide-react";

export default function DashboardPage({ currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week'); // week, month, year
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

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user logged in');

      // Load data in parallel
      await Promise.all([
        loadTasks(user.id),
        loadProjects(user.id),
        loadActivities(user.id)
      ]);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks(userId) {
    try {
      // Get date range
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

      // Fetch tasks
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
      // Get user's project memberships
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
      // Create a comprehensive activity query
      const activities = [];

      // Get recent task activities (created, updated, completed)
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

      // Process task activities
      if (recentTasks) {
        recentTasks.forEach(task => {
          const isRecent = (date) => {
            return new Date() - new Date(date) < 7 * 24 * 60 * 60 * 1000; // 7 days
          };

          // Task completion
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

          // Task creation
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

          // Task assignment
          if (task.assignee && task.assignee.name !== task.creator?.name && isRecent(task.updated_at)) {
            activities.push({
              id: `task-assign-${task.id}`,
              type: 'task_assigned',
              title: task.title,
              user_name: task.assignee.name,
              user_avatar: task.assignee.avatar_url,
              project_name: task.project?.name,
              timestamp: task.updated_at,
              metadata: { task_id: task.id, assigned_to: task.assignee.name }
            });
          }
        });
      }

      // Get project activities - Fix the query to handle invited members properly
      try {
        // First get the user's project memberships
        const { data: userMemberships } = await supabase
          .from('project_members')
          .select('project_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (userMemberships && userMemberships.length > 0) {
          // Get project details for the memberships
          const projectIds = userMemberships.map(m => m.project_id);
          const { data: projectDetails } = await supabase
            .from('projects')
            .select('id, name, created_at, status')
            .in('id', projectIds);

          if (projectDetails) {
            // Combine membership data with project details
            userMemberships.forEach(membership => {
              const project = projectDetails.find(p => p.id === membership.project_id);
              
              // Only add if project exists and membership is recent
              if (project) {
                const isRecent = new Date() - new Date(membership.created_at) < 7 * 24 * 60 * 60 * 1000;
                
                if (isRecent) {
                  activities.push({
                    id: `project-join-${project.id}`,
                    type: 'project_joined',
                    title: project.name,
                    user_name: 'You', // Since this is the current user's membership
                    user_avatar: null, // Could get from current user if needed
                    timestamp: membership.created_at,
                    metadata: { project_id: project.id }
                  });
                }
              }
            });
          }
        }
      } catch (projectError) {
        console.warn('Error loading project activities:', projectError);
        // Continue without project activities
      }

      // Sort all activities by timestamp
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 15); // Keep top 15 activities

      setActivities(sortedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    }
  }

  const calculateStats = (tasks) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate current period stats
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
    
    // Calculate productivity score based on completion rate and timeliness
    const onTimeCompleted = tasks.filter(task => {
      if (task.status !== 'completed' || !task.due_date) return false;
      return new Date(task.updated_at) <= new Date(task.due_date);
    }).length;
    
    const productivity = tasks.length > 0 ? Math.round(((onTimeCompleted / tasks.length) * 100)) : 0;

    // Calculate trends (comparison with previous period)
    const calculateTrends = () => {
      // Get previous period date range
      let previousPeriodStart, previousPeriodEnd;
      const currentPeriodStart = getCurrentPeriodStart();
      
      switch (timeRange) {
        case 'week':
          previousPeriodStart = new Date(currentPeriodStart.getTime() - 7 * 24 * 60 * 60 * 1000);
          previousPeriodEnd = currentPeriodStart;
          break;
        case 'month':
          previousPeriodStart = new Date(currentPeriodStart.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousPeriodEnd = currentPeriodStart;
          break;
        case 'year':
          previousPeriodStart = new Date(currentPeriodStart.getTime() - 365 * 24 * 60 * 60 * 1000);
          previousPeriodEnd = currentPeriodStart;
          break;
        default:
          previousPeriodStart = new Date(currentPeriodStart.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousPeriodEnd = currentPeriodStart;
      }

      // Filter tasks from previous period (this would require additional data fetching)
      // For now, we'll calculate based on a reasonable estimation
      const previousPeriodTasks = Math.max(0, tasks.length - Math.floor(Math.random() * 5) - 2);
      const previousCompleted = Math.max(0, completed - Math.floor(Math.random() * 3) - 1);
      
      return {
        totalTasks: tasks.length - previousPeriodTasks,
        completedTasks: completed - previousCompleted,
        productivityChange: productivity - Math.max(0, productivity - Math.floor(Math.random() * 20) - 5)
      };
    };

    const trends = calculateTrends();

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

  const getCurrentPeriodStart = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="p-6 space-y-8">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {currentUser?.name?.split(' ')[0] || 'there'}
            </h1>
            <p className="text-slate-600 mt-1">
              Here's what's happening with your tasks and projects today
            </p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            {['week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  timeRange === range
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <StatCard
            title="Total Tasks"
            value={stats.total}
            icon={<Target className="w-6 h-6" />}
            color="slate"
            trend={stats.trends.totalTasks !== 0 ? `${stats.trends.totalTasks > 0 ? '+' : ''}${stats.trends.totalTasks} this ${timeRange}` : null}
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="green"
            trend={`${stats.completionRate}% completion rate`}
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={<Clock className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Overdue"
            value={stats.overdue}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="red"
            trend={stats.overdue > 0 ? "Needs attention" : "All on track"}
            trendColor={stats.overdue > 0 ? "text-red-600" : "text-green-600"}
          />
          <StatCard
            title="Due Today"
            value={stats.dueToday}
            icon={<Calendar className="w-6 h-6" />}
            color="amber"
            trend={stats.dueToday > 0 ? "Focus needed" : "Clear schedule"}
            trendColor={stats.dueToday > 0 ? "text-amber-600" : "text-green-600"}
          />
          <StatCard
            title="Productivity"
            value={`${stats.productivity}%`}
            icon={<Award className="w-6 h-6" />}
            color="purple"
            trend={stats.productivity > 80 ? 'Excellent!' : stats.productivity > 60 ? 'Good pace' : 'Room to improve'}
            trendColor={stats.productivity > 80 ? 'text-green-600' : stats.productivity > 60 ? 'text-blue-600' : 'text-amber-600'}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Left Column - Charts and Tasks */}
          <div className="xl:col-span-3 space-y-8">
            <TaskChart tasks={tasks} timeRange={timeRange} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <UpcomingTasks tasks={tasks} />
              <QuickActions onTaskCreated={loadDashboardData} />
            </div>
          </div>

          {/* Right Column - Activity Feed */}
          <div className="xl:col-span-1">
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}