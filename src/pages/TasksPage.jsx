// src/pages/TasksPage.jsx - Enhanced with TaskDetailModal Integration
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import TaskBoard from "../components/tasks/TaskBoard";
import TaskDetailModal from "../components/common/modal/TaskDetailModal";
import TaskModal from "../components/common/modal/TaskModal";
import { supabase } from '../lib/supabase';
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Plus, Filter, Search, Calendar, Users, CheckCircle2, Clock, RefreshCw } from "lucide-react";

// ============================================================================
// CONSTANTS AND MAPPINGS
// ============================================================================

/**
 * Maps frontend status values to backend status values
 */
const STATUS_MAP = {
  "todo": "pending",
  "progress": "in-progress", 
  "complete": "completed"
};

/**
 * Static color classes to avoid dynamic Tailwind class issues
 */
const COLOR_CLASSES = {
  blue: { 
    text: 'text-blue-600', 
    icon: 'text-blue-500',
    bg: 'bg-blue-100',
    ring: 'ring-blue-600/20'
  },
  emerald: { 
    text: 'text-emerald-600', 
    icon: 'text-emerald-500',
    bg: 'bg-emerald-100',
    ring: 'ring-emerald-600/20'
  },
  purple: { 
    text: 'text-purple-600', 
    icon: 'text-purple-500',
    bg: 'bg-purple-100',
    ring: 'ring-purple-600/20'
  },
  orange: { 
    text: 'text-orange-600', 
    icon: 'text-orange-500',
    bg: 'bg-orange-100',
    ring: 'ring-orange-600/20'
  },
  green: { 
    text: 'text-green-600', 
    icon: 'text-green-500',
    bg: 'bg-green-100',
    ring: 'ring-green-600/20'
  },
  red: { 
    text: 'text-red-600', 
    icon: 'text-red-500',
    bg: 'bg-red-100',
    ring: 'ring-red-600/20'
  }
};

/**
 * Configuration for retry operations
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 1,
  RETRY_DELAY: 1000,
  SESSION_REFRESH_DELAY: 3000
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TasksPage({ currentUser, onAuthStateChange }) {
  // ========================================================================
  // HOOKS AND STATE
  // ========================================================================
  
  const location = useLocation();
  const navigate = useNavigate();
  
  // Core state
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // UI state
  const [viewMode, setViewMode] = useState("board");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Task Detail Modal state
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  // Filter state
  const [filterMode, setFilterMode] = useState("all");
  const [selectedProject, setSelectedProject] = useState("");
  const [availableProjects, setAvailableProjects] = useState([]);
  
  // Session state
  const [sessionError, setSessionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Refs for cleanup and stable references
  const timeoutRefs = useRef(new Set());
  const abortControllerRef = useRef(new AbortController());
  const filtersRef = useRef({ filterMode, selectedProject });
  
  // Update filters ref when filters change
  useEffect(() => {
    filtersRef.current = { filterMode, selectedProject };
  }, [filterMode, selectedProject]);

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Cleanup function for timeouts and abort controllers
   */
  const cleanup = useCallback(() => {
    // Clear all pending timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    }
  }, []);

  /**
   * Safe setTimeout that tracks timeout IDs for cleanup
   */
  const safeSetTimeout = useCallback((callback, delay) => {
    const timeoutId = setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      callback();
    }, delay);
    
    timeoutRefs.current.add(timeoutId);
    return timeoutId;
  }, []);

  /**
   * Generic retry wrapper for operations
   */
  const withRetry = useCallback(async (
    operation, 
    operationName, 
    maxRetries = RETRY_CONFIG.MAX_RETRIES
  ) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) break;
        
        // Check if this is a retryable error
        if (error.message?.includes('JWT') || 
            error.message?.includes('auth') || 
            error.code === 'PGRST301') {
          
          console.log(`${operationName} failed, retrying in ${RETRY_CONFIG.RETRY_DELAY}ms...`);
          
          // Wait before retry
          await new Promise(resolve => 
            safeSetTimeout(resolve, RETRY_CONFIG.RETRY_DELAY * (attempt + 1))
          );
        } else {
          // Non-retryable error, fail immediately
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  }, [safeSetTimeout]);

  // ========================================================================
  // SESSION MANAGEMENT
  // ========================================================================

  /**
   * Validates current session and refreshes if needed
   */
  const validateSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session validation error:', error);
        setSessionError(true);
        return false;
      }

      if (!session) {
        console.log('No active session found');
        setSessionError(true);
        return false;
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        console.log('Session expired, attempting refresh...');
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          console.error('Session refresh failed:', refreshError);
          setSessionError(true);
          return false;
        }

        // Notify parent component of session change
        if (onAuthStateChange) {
          onAuthStateChange(refreshData.session, refreshData.user);
        }
      }

      setSessionError(false);
      setRetryCount(0);
      return true;
    } catch (err) {
      console.error('Session validation failed:', err);
      setSessionError(true);
      return false;
    }
  }, [onAuthStateChange]);

  /**
   * Enhanced error handler for API calls with session management
   */
  const handleApiError = useCallback(async (error, operation) => {
    console.error(`${operation} failed:`, error);

    // Check if error is authentication related
    if (error.message?.includes('JWT') || 
        error.message?.includes('auth') || 
        error.code === 'PGRST301') {
      
      console.log('Authentication error detected, validating session...');
      const sessionValid = await validateSession();

      if (!sessionValid) {
        setError('Your session has expired. Redirecting to login...');
        setSessionError(true);
        
        // Redirect to login after a delay
        safeSetTimeout(() => {
          navigate('/login');
        }, RETRY_CONFIG.SESSION_REFRESH_DELAY);
        return;
      }

      // Session is valid but we still got an auth error
      if (retryCount < RETRY_CONFIG.MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        return;
      }
    }

    // Set user-friendly error message
    setError(`${operation} failed. Please try again.`);
  }, [validateSession, navigate, retryCount, safeSetTimeout]);

  // ========================================================================
  // DATA LOADING FUNCTIONS
  // ========================================================================

  /**
   * Loads available projects for the current user
   */
  const loadAvailableProjects = useCallback(async (userId) => {
    if (!userId) return;

    await withRetry(async () => {
      // Get user's project memberships
      const { data: membershipData, error: membershipError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)
        .abortSignal(abortControllerRef.current.signal);

      if (membershipError) throw membershipError;

      if (membershipData && membershipData.length > 0) {
        const projectIds = membershipData.map(m => m.project_id);

        // Get project details
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds)
          .order('name')
          .abortSignal(abortControllerRef.current.signal);

        if (projectsError) throw projectsError;

        setAvailableProjects(projects || []);
      } else {
        setAvailableProjects([]);
      }
    }, 'Loading projects').catch(() => {
      // Error already handled by handleApiError in withRetry
      setAvailableProjects([]);
    });
  }, [withRetry]);

  /**
   * Loads tasks based on current filter settings
   */
  const loadTasks = useCallback(async (userId, forceRefresh = false) => {
    if (!userId) return;

    // Don't reload if we already have data and not forcing refresh
    if (dataLoaded && !forceRefresh && tasks.length > 0) {
      return;
    }

    // Validate session before making API calls
    const sessionValid = await validateSession();
    if (!sessionValid) return;

    setLoading(true);
    setError(null);

    await withRetry(async () => {
      // Get current filter values from ref to avoid stale closures
      const { filterMode: currentFilterMode, selectedProject: currentSelectedProject } = filtersRef.current;
      
      let query = supabase.from('task_details').select('*');

      // Apply filters based on current mode
      switch (currentFilterMode) {
        case "personal":
          // Only personal tasks (not in any project)
          query = query.eq('user_id', userId).is('project_id', null);
          break;

        case "project":
          // All project tasks where user is a member (RLS handles filtering)
          query = query.not('project_id', 'is', null);
          if (currentSelectedProject) {
            query = query.eq('project_id', currentSelectedProject);
          }
          break;

        case "assigned":
          // Tasks specifically assigned to this user
          query = query.eq('assigned_to', userId);
          break;

        default: // "all"
          // Let RLS handle all the filtering
          break;
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1000)
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      setTasks(data || []);
      setDataLoaded(true);
    }, 'Loading tasks').catch(() => {
      // Error already handled by handleApiError in withRetry
    }).finally(() => {
      setLoading(false);
    });
  }, [validateSession, withRetry, dataLoaded, tasks.length]);

  // ========================================================================
  // TASK OPERATIONS
  // ========================================================================

  /**
   * Creates a new task
   */
  const handleAdd = useCallback(async (taskPayload) => {
    if (!currentUser?.id) {
      setError('User session expired. Please refresh the page.');
      return;
    }

    const sessionValid = await validateSession();
    if (!sessionValid) return;

    await withRetry(async () => {
      const backendTask = {
        title: taskPayload.title,
        description: taskPayload.description || "",
        status: STATUS_MAP[taskPayload.status] || "pending",
        priority: taskPayload.priority || "medium",
        due_date: taskPayload.dueDate || null,
        start_time: taskPayload.dueDate ? new Date(taskPayload.dueDate).toISOString() : null,
        end_time: taskPayload.dueDate ? new Date(taskPayload.dueDate).toISOString() : null,
        all_day: taskPayload.allDay || false,
        user_id: currentUser.id,
        created_by: currentUser.id,
        project_id: taskPayload.projectId || null,
        assigned_to: taskPayload.assignedTo || null
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([backendTask])
        .select()
        .single()
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      setTasks(prev => [data, ...prev]);
      setIsAddModalOpen(false);
    }, 'Creating task');
  }, [currentUser, validateSession, withRetry]);

  /**
   * Deletes a task
   */
  const handleDelete = useCallback(async (id) => {
    if (!currentUser?.id) {
      setError('User session expired. Please refresh the page.');
      return;
    }

    const sessionValid = await validateSession();
    if (!sessionValid) return;

    await withRetry(async () => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== id));
    }, 'Deleting task');
  }, [currentUser, validateSession, withRetry]);

  /**
   * Updates a task
   */
  const handleEdit = useCallback(async (taskId, updates) => {
    if (!currentUser?.id) {
      setError('User session expired. Please refresh the page.');
      return;
    }

    const sessionValid = await validateSession();
    if (!sessionValid) return;

    await withRetry(async () => {
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
        backendUpdates.status = STATUS_MAP[updates.status] || "pending";
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

      const { error } = await supabase
        .from('tasks')
        .update(backendUpdates)
        .eq('id', taskId)
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      setTasks(prev => prev.map(task =>
        task.id === taskId ? { ...task, ...backendUpdates } : task
      ));
    }, 'Updating task');
  }, [currentUser, validateSession, withRetry]);

  /**
   * Updates task status
   */
  const handleStatusChange = useCallback(async (taskId, updates) => {
    if (!currentUser?.id) {
      setError('User session expired. Please refresh the page.');
      return;
    }

    const sessionValid = await validateSession();
    if (!sessionValid) return;

    await withRetry(async () => {
      const backendUpdates = {
        status: updates.status === 'pending' ? 'pending' :
               updates.status === 'in-progress' ? 'in-progress' : 'completed',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tasks')
        .update(backendUpdates)
        .eq('id', taskId)
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      setTasks(prev => prev.map(task =>
        task.id === taskId ? {
          ...task,
          ...backendUpdates,
          displayStatus: backendUpdates.status === "pending" ? "todo" :
                        backendUpdates.status === "in-progress" ? "progress" : "complete"
        } : task
      ));
    }, 'Updating task status');
  }, [currentUser, validateSession, withRetry]);

  /**
   * Manual refresh function
   */
  const handleRefresh = useCallback(async () => {
    if (currentUser?.id) {
      setDataLoaded(false);
      setRetryCount(0);
      setError(null);
      
      await Promise.all([
        loadTasks(currentUser.id, true),
        loadAvailableProjects(currentUser.id)
      ]);
    }
  }, [currentUser?.id, loadTasks, loadAvailableProjects]);

  // ========================================================================
  // TASK MODAL HANDLERS
  // ========================================================================

  /**
   * Handle task item click to show details
   */
  const handleTaskClick = useCallback((task) => {
    setSelectedTask(task);
    setIsTaskDetailModalOpen(true);
  }, []);

  /**
   * Handle task edit from detail modal
   */
  const handleTaskEditFromDetail = useCallback((task) => {
    // Close detail modal and open edit modal
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
    
    // Set up edit modal
    setEditingTask(task);
    setIsEditModalOpen(true);
  }, []);

  /**
   * Handle edit form submission
   */
  const handleEditSubmit = useCallback(async (updatedData) => {
    if (!editingTask || !currentUser?.id) {
      setError('User session expired. Please refresh the page.');
      return;
    }

    const sessionValid = await validateSession();
    if (!sessionValid) return;

    await withRetry(async () => {
      const backendUpdates = {
        title: updatedData.title,
        description: updatedData.description,
        priority: updatedData.priority,
        all_day: updatedData.allDay || false,
        updated_at: new Date().toISOString(),
        project_id: updatedData.projectId || null,
        assigned_to: updatedData.assignedTo || null
      };

      if (updatedData.status) {
        backendUpdates.status = STATUS_MAP[updatedData.status] || "pending";
      }

      if (updatedData.dueDate) {
        backendUpdates.due_date = updatedData.dueDate;
        backendUpdates.start_time = new Date(updatedData.dueDate).toISOString();
        backendUpdates.end_time = new Date(updatedData.dueDate).toISOString();
      } else if (updatedData.dueDate === null || updatedData.dueDate === '') {
        backendUpdates.due_date = null;
        backendUpdates.start_time = null;
        backendUpdates.end_time = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(backendUpdates)
        .eq('id', editingTask.id)
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      setTasks(prev => prev.map(task =>
        task.id === editingTask.id ? { ...task, ...backendUpdates } : task
      ));

      // Close edit modal and cleanup
      setIsEditModalOpen(false);
      setEditingTask(null);
    }, 'Updating task');
  }, [editingTask, currentUser, validateSession, withRetry]);

  /**
   * Close task detail modal
   */
  const handleCloseTaskDetail = useCallback(() => {
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
  }, []);

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  /**
   * Filtered tasks based on search query
   */
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    
    const query = searchQuery.toLowerCase().trim();
    return tasks.filter(task =>
      task.title?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  /**
   * Display tasks with frontend status mapping
   */
  const displayTasks = useMemo(() => {
    return filteredTasks.map(task => ({
      ...task,
      displayStatus: task.status === "pending" ? "todo" :
                    task.status === "in-progress" ? "progress" : "complete",
      dueDate: task.due_date
    }));
  }, [filteredTasks]);

  /**
   * Task statistics for dashboard
   */
  const taskStats = useMemo(() => {
    const now = new Date();
    
    return {
      total: displayTasks.length,
      personal: displayTasks.filter(t => !t.project_id).length,
      project: displayTasks.filter(t => t.project_id).length,
      assigned: displayTasks.filter(t => t.assigned_to === currentUser?.id).length,
      completed: displayTasks.filter(t => t.displayStatus === 'complete').length,
      overdue: displayTasks.filter(t => {
        if (!t.due_date || t.displayStatus === 'complete') return false;
        return new Date(t.due_date) < now;
      }).length
    };
  }, [displayTasks, currentUser?.id]);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * Session monitoring
   */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);

        switch (event) {
          case 'SIGNED_OUT':
            setSessionError(true);
            cleanup();
            navigate('/login');
            break;
            
          case 'TOKEN_REFRESHED':
            if (session?.user && onAuthStateChange) {
              onAuthStateChange(session, session.user);
            }
            setSessionError(false);
            break;
            
          default:
            break;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, onAuthStateChange, cleanup]);

  /**
   * Load initial data when user is available
   */
  useEffect(() => {
    if (currentUser?.id && !sessionError) {
      const loadInitialData = async () => {
        await Promise.all([
          loadTasks(currentUser.id),
          loadAvailableProjects(currentUser.id)
        ]);
      };

      loadInitialData();
    }
  }, [currentUser?.id, sessionError, loadTasks, loadAvailableProjects]);

  /**
   * Reload when filters change
   */
  useEffect(() => {
    if (currentUser?.id && dataLoaded && !sessionError) {
      loadTasks(currentUser.id, true);
    }
  }, [filterMode, selectedProject, currentUser?.id, dataLoaded, sessionError, loadTasks]);

  /**
   * Handle navigation state for opening add modal
   */
  useEffect(() => {
    if (location.state?.openAddModal) {
      setIsAddModalOpen(true);
      // Clear the navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle if not typing in an input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'n':
            event.preventDefault();
            setIsAddModalOpen(true);
            break;
          case 'b':
            event.preventDefault();
            setViewMode('board');
            break;
          case 'l':
            event.preventDefault();
            setViewMode('list');
            break;
          case 't':
            event.preventDefault();
            setViewMode('table');
            break;
          case 'r':
            event.preventDefault();
            handleRefresh();
            break;
          case 'Escape':
            // Close modals on Escape
            if (isTaskDetailModalOpen) {
              event.preventDefault();
              handleCloseTaskDetail();
            } else if (isEditModalOpen) {
              event.preventDefault();
              setIsEditModalOpen(false);
              setEditingTask(null);
            }
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh, isTaskDetailModalOpen, isEditModalOpen, handleCloseTaskDetail]);

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  /**
   * Gets color classes for a given color key
   */
  const getColorClasses = (color) => {
    return COLOR_CLASSES[color] || COLOR_CLASSES.blue;
  };

  /**
   * Statistics card configuration
   */
  const statsConfig = [
    { key: 'total', label: 'Total', value: taskStats.total, icon: CheckCircle2, color: 'blue' },
    { key: 'personal', label: 'Personal', value: taskStats.personal, icon: Users, color: 'emerald' },
    { key: 'project', label: 'Project', value: taskStats.project, icon: Users, color: 'purple' },
    { key: 'assigned', label: 'Assigned', value: taskStats.assigned, icon: Users, color: 'orange' },
    { key: 'completed', label: 'Done', value: taskStats.completed, icon: CheckCircle2, color: 'green' },
    { key: 'overdue', label: 'Overdue', value: taskStats.overdue, icon: Clock, color: 'red' }
  ];

  /**
   * Filter chips configuration
   */
  const filterChips = [
    { key: 'all', label: 'All Tasks', count: taskStats.total },
    { key: 'personal', label: 'Personal', count: taskStats.personal },
    { key: 'project', label: 'Project', count: taskStats.project },
    { key: 'assigned', label: 'Assigned', count: taskStats.assigned }
  ];

  /**
   * View mode options
   */
  const viewModes = [
    { mode: 'board', icon: Filter, label: 'Board' },
    { mode: 'list', icon: CheckCircle2, label: 'List' },
    { mode: 'table', icon: Calendar, label: 'Table' }
  ];

  // ========================================================================
  // RENDER
  // ========================================================================

  // Show session error screen
  if (!currentUser || sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            {sessionError ? 'Session Expired' : 'Session Required'}
          </h2>
          <p className="text-slate-600 mb-6">
            {sessionError
              ? 'Your session has expired for security reasons. Please log in again to continue.'
              : 'Please log in to view your tasks.'
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Go to Login
            </button>
            {sessionError && (
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Refresh Page
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center justify-between">
            <p className="text-red-800 text-sm font-medium">{error}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 font-medium transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Retry
              </button>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-sm bg-white/80 rounded-t-xl">
        <div className="px-6 py-4">
          {/* Title Section */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tasks</h1>
              <p className="text-slate-600 text-sm">Manage your personal and project tasks</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                title="Refresh tasks (Ctrl+R)"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </button>
            </div>
          </div>

          {/* Search and View Mode Controls */}
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
              {viewModes.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === mode
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

        {/* Statistics Cards */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {statsConfig.map(({ key, label, value, icon: Icon, color }) => {
              const colorClasses = getColorClasses(color);
              return (
                <div
                  key={key}
                  className="bg-white rounded-xl p-3 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
                  onClick={() => setFilterMode(key === 'total' ? 'all' : key)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">{label}</p>
                      <p className={`text-lg font-bold ${colorClasses.text}`}>{value}</p>
                    </div>
                    <Icon className={`w-5 h-5 ${colorClasses.icon}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {filterChips.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterMode === key
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

          {/* Project Filter Dropdown */}
          {filterMode === 'project' && availableProjects.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Project:</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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

      {/* Main Content Area */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-xl border border-slate-200">
            <LoadingSpinner />
            <p className="ml-4 text-slate-600 font-medium">Loading tasks...</p>
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {searchQuery ? 'No tasks found' : 'No tasks yet'}
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              {searchQuery 
                ? `No tasks match "${searchQuery}". Try adjusting your search or filters.`
                : 'Get started by creating your first task to organize your work.'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Task
              </button>
            )}
          </div>
        ) : (
          <TaskBoard
            tasks={displayTasks}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onStatusChange={handleStatusChange}
            onAdd={handleAdd}
            onTaskClick={handleTaskClick}
            viewMode={viewMode}
            isAddModalOpen={isAddModalOpen}
            onAddModalClose={() => setIsAddModalOpen(false)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            availableProjects={availableProjects}
            currentUser={currentUser}
          />
        )}
      </div>

      {/* Loading Overlay for Non-blocking Operations */}
      {loading && displayTasks.length > 0 && (
        <div className="fixed top-4 right-4 bg-white border border-slate-200 rounded-lg p-3 shadow-lg z-50">
          <div className="flex items-center gap-3">
            <LoadingSpinner />
            <span className="text-sm text-slate-600 font-medium">Refreshing tasks...</span>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        open={isTaskDetailModalOpen}
        onClose={handleCloseTaskDetail}
        task={selectedTask}
        onEdit={handleTaskEditFromDetail}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        availableProjects={availableProjects}
        currentUser={currentUser}
      />

      {/* Task Edit Modal */}
      <TaskModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleEditSubmit}
        initialData={editingTask}
        isEditing={true}
        allowProjectSelection={true}
        availableProjects={availableProjects}
        currentUser={currentUser}
      />
    </div>
  );
}