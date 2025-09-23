// src/pages/TasksPage.jsx - Modernized
import React, { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import TaskBoard from "../components/tasks/TaskBoard";
import { supabase } from '../lib/supabase';
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Plus, Filter, Search, Calendar, Users, CheckCircle2, Clock, Zap } from "lucide-react";

// Map frontend status to backend status
const statusMap = {
  "todo": "pending",
  "progress": "in-progress",
  "complete": "completed"
};

export default function TasksPage() {
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("board");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterMode, setFilterMode] = useState("all");
  const [selectedProject, setSelectedProject] = useState("");
  const [availableProjects, setAvailableProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Check if we should open the add modal from navigation state
  useEffect(() => {
    if (location.state?.openAddModal) {
      setIsAddModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    loadTasks();
    loadAvailableProjects();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [filterMode, selectedProject]);

  async function loadAvailableProjects() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membershipData } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      if (membershipData && membershipData.length > 0) {
        const projectIds = membershipData.map(m => m.project_id);

        const { data: projects, error } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds)
          .order('name');

        if (error) throw error;
        setAvailableProjects(projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  async function loadTasks() {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user logged in');

      let query = supabase.from('task_details').select('*');

      switch (filterMode) {
        case "personal":
          query = query.eq('user_id', user.id).is('project_id', null);
          break;
        case "project":
          query = query.not('project_id', 'is', null);
          if (selectedProject) {
            query = query.eq('project_id', selectedProject);
          }
          const { data: membershipData } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user.id);

          if (membershipData && membershipData.length > 0) {
            const projectIds = membershipData.map(m => m.project_id);
            query = query.in('project_id', projectIds);
          } else {
            query = query.eq('project_id', 'no-projects');
          }
          break;
        case "assigned":
          query = query.eq('assigned_to', user.id);
          break;
        default:
          query = query.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(taskPayload) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user logged in');

      const backendTask = {
        title: taskPayload.title,
        description: taskPayload.description || "",
        status: statusMap[taskPayload.status] || "pending",
        priority: taskPayload.priority || "medium",
        due_date: taskPayload.dueDate || null,
        start_time: taskPayload.dueDate ? new Date(taskPayload.dueDate).toISOString() : null,
        end_time: taskPayload.dueDate ? new Date(taskPayload.dueDate).toISOString() : null,
        all_day: taskPayload.allDay || false,
        user_id: user.id,
        created_by: user.id,
        project_id: taskPayload.projectId || null,
        assigned_to: taskPayload.assignedTo || null
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([backendTask])
        .select()
        .single();

      if (error) throw error;

      loadTasks();
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  }

  async function handleDelete(id) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user logged in');

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);

      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }

  async function handleEdit(taskId, updates) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('No user logged in');

      const backendUpdates = {
        title: updates.title,
        description: updates.description,
        priority: updates.priority,
        all_day: updates.allDay || false,
        updated_at: new Date().toISOString(),
        project_id: updates.projectId || null,
        assigned_to: updates.assignedTo || null
      };

      if (updates.status) {
        backendUpdates.status = statusMap[updates.status] || "pending";
      }

      if (updates.dueDate) {
        backendUpdates.due_date = updates.dueDate;
        backendUpdates.start_time = new Date(updates.dueDate).toISOString();
        backendUpdates.end_time = new Date(updates.dueDate).toISOString();
      } else if (updates.dueDate === null || updates.dueDate === '') {
        backendUpdates.due_date = null;
        backendUpdates.start_time = null;
        backendUpdates.end_time = null;
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(backendUpdates)
        .eq('id', taskId)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
      // .select()
      // .single();

      if (error) throw error;
      // loadTasks();
      // Update local state instead of reloading
      setTasks(prev => prev.map(task =>
        task.id === taskId ? { ...task, ...backendUpdates } : task
      ));
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }

  // Filter tasks based on search query
  const filteredTasks = tasks.filter(task =>
    task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Transform backend tasks for frontend display
  const displayTasks = filteredTasks.map(task => ({
    ...task,
    displayStatus: task.status === "pending" ? "todo" :
      task.status === "in-progress" ? "progress" : "complete",
    dueDate: task.due_date
  }));

  const handleStatusChange = async (taskId, updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const backendUpdates = {
        status: updates.status === 'pending' ? 'pending' :
          updates.status === 'in-progress' ? 'in-progress' : 'completed',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(backendUpdates)
        .eq('id', taskId)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
      // .select()
      // .single();

      if (error) throw error;

      // If update was successful, refresh the task locally
      setTasks(prev => prev.map(task =>
        task.id === taskId ? {
          ...task,
          status: backendUpdates.status,
          displayStatus: backendUpdates.status === "pending" ? "todo" :
            backendUpdates.status === "in-progress" ? "progress" : "complete",
          updated_at: backendUpdates.updated_at
        } : task
      ));
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  // Get task statistics for display
  const taskStats = {
    total: displayTasks.length,
    personal: displayTasks.filter(t => !t.project_id).length,
    project: displayTasks.filter(t => t.project_id).length,
    assigned: displayTasks.filter(t => t.assigned_to).length,
    completed: displayTasks.filter(t => t.displayStatus === 'complete').length,
    overdue: displayTasks.filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date() && t.displayStatus !== 'complete';
    }).length
  };

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.ctrlKey && event.key === "n") {
        event.preventDefault();
        setIsAddModalOpen(true);
      } else if (event.ctrlKey && event.key === "b") {
        setViewMode("board");
      } else if (event.ctrlKey && event.key === "l") {
        setViewMode("list");
      } else if (event.ctrlKey && event.key === "t") {
        setViewMode("table");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Modern Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-sm bg-white/80">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tasks</h1>
              <p className="text-slate-600 text-sm">Manage your personal and project tasks</p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </button>
          </div>

          {/* Search and Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              {[
                { mode: 'board', icon: Filter, label: 'Board' },
                { mode: 'list', icon: CheckCircle2, label: 'List' },
                { mode: 'table', icon: Calendar, label: 'Table' }
              ].map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === mode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Statistics Cards */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { key: 'total', label: 'Total', value: taskStats.total, icon: CheckCircle2, color: 'blue' },
              { key: 'personal', label: 'Personal', value: taskStats.personal, icon: Users, color: 'emerald' },
              { key: 'project', label: 'Project', value: taskStats.project, icon: Users, color: 'purple' },
              { key: 'assigned', label: 'Assigned', value: taskStats.assigned, icon: Users, color: 'orange' },
              { key: 'completed', label: 'Done', value: taskStats.completed, icon: CheckCircle2, color: 'green' },
              { key: 'overdue', label: 'Overdue', value: taskStats.overdue, icon: Clock, color: 'red' }
            ].map(({ key, label, value, icon: Icon, color }) => (
              <div
                key={key}
                className="bg-white rounded-xl p-3 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
                onClick={() => setFilterMode(key === 'total' ? 'all' : key)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{label}</p>
                    <p className={`text-lg font-bold text-${color}-600`}>{value}</p>
                  </div>
                  <Icon className={`w-5 h-5 text-${color}-500`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Tasks', count: taskStats.total },
              { key: 'personal', label: 'Personal', count: taskStats.personal },
              { key: 'project', label: 'Project', count: taskStats.project },
              { key: 'assigned', label: 'Assigned', count: taskStats.assigned }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterMode === key
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {label}
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/60 rounded-full text-xs">
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Project Filter */}
          {filterMode === 'project' && availableProjects.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Project:</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Projects</option>
                {availableProjects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Task Board */}
      <div className="px-6 py-6">
        <TaskBoard
          tasks={displayTasks}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onStatusChange={handleStatusChange}
          onAdd={handleAdd}
          viewMode={viewMode}
          isAddModalOpen={isAddModalOpen}
          onAddModalClose={() => setIsAddModalOpen(false)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />
      </div>
    </div>
  );
}