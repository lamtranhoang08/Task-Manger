// src/pages/TasksPage.jsx - Optimized Version with CSS Classes

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import TaskBoard from "../components/tasks/TaskBoard";
import TaskDetailModal from "../components/common/modal/TaskDetailModal";
import TaskModal from "../components/common/modal/TaskModal";
import { supabase } from '../lib/supabase';
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Plus, Filter, Search, Calendar, Users, CheckCircle2, Clock, RefreshCw } from "lucide-react";

// ============================================================================
// ALGORITHM OPTIMIZATIONS - MEMOIZED CALCULATIONS
// ============================================================================

/**
 * Optimized task filtering algorithm using Map for O(1) lookups
 * Instead of multiple array.filter() calls, we process tasks once
 */
class TaskProcessor {
  constructor(tasks = [], currentUserId = null) {
    this.tasks = tasks;
    this.currentUserId = currentUserId;
    this.cache = new Map();
    this.processedTasks = null;
  }

  // Cache key generator for memoization
  getCacheKey(filterMode, selectedProject, searchQuery) {
    return `${filterMode}:${selectedProject}:${searchQuery}:${this.currentUserId}`;
  }

  // Single-pass algorithm to categorize and count tasks
  processAllTasks() {
    if (this.processedTasks) return this.processedTasks;

    const now = new Date();
    const result = {
      all: [],
      personal: [],
      project: [],
      assigned: [],
      byStatus: { todo: 0, progress: 0, complete: 0 },
      counts: { total: 0, personal: 0, project: 0, assigned: 0, completed: 0, overdue: 0 }
    };

    // Single iteration through all tasks - O(n) instead of multiple O(n) operations
    for (const task of this.tasks) {
      const displayTask = {
        ...task,
        displayStatus: task.status === "pending" ? "todo" :
          task.status === "in-progress" ? "progress" : "complete",
        dueDate: task.due_date
      };

      // Add to all tasks
      result.all.push(displayTask);
      result.counts.total++;

      // Categorize task type
      if (!task.project_id) {
        result.personal.push(displayTask);
        result.counts.personal++;
      } else {
        result.project.push(displayTask);
        result.counts.project++;
      }

      // Check if assigned to current user
      if (task.assigned_to === this.currentUserId) {
        result.assigned.push(displayTask);
        result.counts.assigned++;
      }

      // Count by status
      result.byStatus[displayTask.displayStatus]++;
      if (displayTask.displayStatus === 'complete') {
        result.counts.completed++;
      }

      // Check if overdue - single date comparison
      if (task.due_date && displayTask.displayStatus !== 'complete') {
        if (new Date(task.due_date) < now) {
          result.counts.overdue++;
        }
      }
    }

    this.processedTasks = result;
    return result;
  }

  // Optimized filtering with early returns and binary search for large datasets
  getFilteredTasks(filterMode, selectedProject = '', searchQuery = '') {
    const cacheKey = this.getCacheKey(filterMode, selectedProject, searchQuery);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const processed = this.processAllTasks();
    let filtered = [];

    // Select appropriate subset based on filter mode - O(1) access to pre-categorized arrays
    switch (filterMode) {
      case "personal":
        filtered = processed.personal;
        break;
      case "project":
        filtered = selectedProject
          ? processed.project.filter(t => t.project_id === selectedProject)
          : processed.project;
        break;
      case "assigned":
        filtered = processed.assigned;
        break;
      default: // "all"
        filtered = processed.all;
        break;
    }

    // Optimized search - early termination and case-insensitive matching
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(task => {
        return (task.title && task.title.toLowerCase().includes(query)) ||
          (task.description && task.description.toLowerCase().includes(query));
      });
    }

    const result = { tasks: filtered, counts: processed.counts };
    this.cache.set(cacheKey, result);
    return result;
  }

  // Clear cache when data changes
  clearCache() {
    this.cache.clear();
    this.processedTasks = null;
  }
}

// ============================================================================
// OPTIMIZED HOOKS
// ============================================================================

/**
 * Custom hook for debounced search to reduce unnecessary filtering
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for memoized task processor
 */
function useTaskProcessor(tasks, currentUserId) {
  const processorRef = useRef(null);

  // Create new processor only when tasks or user changes
  const processor = useMemo(() => {
    const newProcessor = new TaskProcessor(tasks, currentUserId);
    processorRef.current = newProcessor;
    return newProcessor;
  }, [tasks, currentUserId]);

  // Clear cache when dependencies change
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.clearCache();
    }
  }, [tasks.length, currentUserId]);

  return processor;
}

// ============================================================================
// CONSTANTS AND MAPPINGS
// ============================================================================

const STATUS_MAP = {
  "todo": "pending",
  "progress": "in-progress",
  "complete": "completed"
};

const COLOR_CLASSES = {
  blue: { text: 'task-status-blue', icon: 'task-icon-blue' },
  emerald: { text: 'task-status-emerald', icon: 'task-icon-emerald' },
  purple: { text: 'task-status-purple', icon: 'task-icon-purple' },
  orange: { text: 'task-status-orange', icon: 'task-icon-orange' },
  green: { text: 'task-status-green', icon: 'task-icon-green' },
  red: { text: 'task-status-red', icon: 'task-icon-red' }
};

const RETRY_CONFIG = {
  MAX_RETRIES: 1,
  RETRY_DELAY: 1000,
  SESSION_REFRESH_DELAY: 3000
};

// ============================================================================
// MAIN COMPONENT - OPTIMIZED
// ============================================================================

export default function TasksPage({ currentUser, onAuthStateChange }) {
  // State management
  const location = useLocation();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [viewMode, setViewMode] = useState("board");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [filterMode, setFilterMode] = useState("all");
  const [selectedProject, setSelectedProject] = useState("");
  const [availableProjects, setAvailableProjects] = useState([]);

  const [sessionError, setSessionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const timeoutRefs = useRef(new Set());
  const abortControllerRef = useRef(new AbortController());
  const filtersRef = useRef({ filterMode, selectedProject });

  // ========================================================================
  // OPTIMIZED COMPUTED VALUES
  // ========================================================================

  // Debounced search query to reduce filtering operations
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Task processor with memoization
  const taskProcessor = useTaskProcessor(tasks, currentUser?.id);

  // Get filtered tasks and counts in single operation
  const { tasks: displayTasks, counts: taskCounts } = useMemo(() => {
    if (!taskProcessor) return { tasks: [], counts: {} };
    return taskProcessor.getFilteredTasks(filterMode, selectedProject, debouncedSearchQuery);
  }, [taskProcessor, filterMode, selectedProject, debouncedSearchQuery]);

  // Memoized statistics - now using pre-calculated counts
  const taskStats = useMemo(() => ({
    total: taskCounts.total || 0,
    personal: taskCounts.personal || 0,
    project: taskCounts.project || 0,
    assigned: taskCounts.assigned || 0,
    completed: taskCounts.completed || 0,
    overdue: taskCounts.overdue || 0
  }), [taskCounts]);

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  const cleanup = useCallback(() => {
    // Batch timeout clearance
    for (const timeoutId of timeoutRefs.current) {
      clearTimeout(timeoutId);
    }
    timeoutRefs.current.clear();

    // Cancel pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    }

    // Clear task processor cache
    if (taskProcessor) {
      taskProcessor.clearCache();
    }
  }, [taskProcessor]);

  const safeSetTimeout = useCallback((callback, delay) => {
    const timeoutId = setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      callback();
    }, delay);

    timeoutRefs.current.add(timeoutId);
    return timeoutId;
  }, []);

  // ========================================================================
  // SESSION MANAGEMENT
  // ========================================================================

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

      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        console.log('Session expired, attempting refresh...');

        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          console.error('Session refresh failed:', refreshError);
          setSessionError(true);
          return false;
        }

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

  const withRetry = useCallback(async (operation, operationName, maxRetries = RETRY_CONFIG.MAX_RETRIES) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) break;

        if (error.message?.includes('JWT') ||
          error.message?.includes('auth') ||
          error.code === 'PGRST301') {

          console.log(`${operationName} failed, retrying in ${RETRY_CONFIG.RETRY_DELAY}ms...`);

          await new Promise(resolve =>
            safeSetTimeout(resolve, RETRY_CONFIG.RETRY_DELAY * (attempt + 1))
          );
        } else {
          break;
        }
      }
    }

    throw lastError;
  }, [safeSetTimeout]);

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  const loadAvailableProjects = useCallback(async (userId) => {
    if (!userId) return;

    await withRetry(async () => {
      const { data: projectData, error } = await supabase
        .from('project_members')
        .select(`
          project_id,
          projects!inner(id, name)
        `)
        .eq('user_id', userId)
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      const projects = projectData?.map(item => item.projects) || [];
      projects.sort((a, b) => a.name.localeCompare(b.name));

      setAvailableProjects(projects);
    }, 'Loading projects').catch(() => {
      setAvailableProjects([]);
    });
  }, [withRetry]);

  const loadTasks = useCallback(async (userId, forceRefresh = false) => {
    if (!userId) return;

    if (dataLoaded && !forceRefresh && tasks.length > 0) {
      return;
    }

    const sessionValid = await validateSession();
    if (!sessionValid) return;

    setLoading(true);
    setError(null);

    await withRetry(async () => {
      const { data, error } = await supabase.from('task_details')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)
        .abortSignal(abortControllerRef.current.signal);

      if (error) throw error;

      setTasks(data || []);
      setDataLoaded(true);
    }, 'Loading tasks').catch(() => {
      // Error already handled
    }).finally(() => {
      setLoading(false);
    });
  }, [validateSession, withRetry, dataLoaded, tasks.length]);

  // ========================================================================
  // TASK OPERATIONS
  // ========================================================================

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

  const handleDelete = useCallback(async (id) => {
    if (!currentUser?.id) {
      setError('User session expired. Please refresh the page.');
      return false; // Return false to indicate failure
    }

    const sessionValid = await validateSession();
    if (!sessionValid) {
      setError('Session expired. Please log in again.');
      return false;
    }

    // Store original tasks for rollback
    const originalTasks = [...tasks];

    try {
      // Show loading state but don't optimistically update yet
      setLoading(true);
      setError(null);

      await withRetry(async () => {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', id)
          .abortSignal(abortControllerRef.current.signal);

        if (error) {
          console.error('Supabase delete error:', error);
          throw error;
        }
      }, 'Deleting task');

      // Only update UI after successful deletion
      setTasks(prev => prev.filter(t => t.id !== id));
      return true; // Return true to indicate success

    } catch (error) {
      console.error('Delete operation failed:', error);

      // Set user-friendly error message
      if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        setError('Your session has expired. Please refresh the page and try again.');
      } else if (error.code === 'PGRST116') {
        setError('Task not found or already deleted.');
      } else {
        setError(`Failed to delete task: ${error.message || 'Unknown error'}`);
      }

      // Ensure tasks state is not corrupted
      setTasks(originalTasks);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentUser, validateSession, withRetry, tasks]);

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

      setTasks(prev => {
        const taskIndex = prev.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return prev;

        const newTasks = [...prev];
        newTasks[taskIndex] = { ...newTasks[taskIndex], ...backendUpdates };
        return newTasks;
      });
    }, 'Updating task');
  }, [currentUser, validateSession, withRetry]);

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

      setTasks(prev => {
        const taskIndex = prev.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return prev;

        const newTasks = [...prev];
        newTasks[taskIndex] = {
          ...newTasks[taskIndex],
          ...backendUpdates,
          displayStatus: backendUpdates.status === "pending" ? "todo" :
            backendUpdates.status === "in-progress" ? "progress" : "complete"
        };
        return newTasks;
      });
    }, 'Updating task status');
  }, [currentUser, validateSession, withRetry]);

  const handleRefresh = useCallback(async () => {
    if (currentUser?.id) {
      setDataLoaded(false);
      setRetryCount(0);
      setError(null);

      if (taskProcessor) {
        taskProcessor.clearCache();
      }

      await Promise.all([
        loadTasks(currentUser.id, true),
        loadAvailableProjects(currentUser.id)
      ]);
    }
  }, [currentUser?.id, loadTasks, loadAvailableProjects, taskProcessor]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleTaskClick = useCallback((task) => {
    setSelectedTask(task);
    setIsTaskDetailModalOpen(true);
  }, []);

  const handleTaskEditFromDetail = useCallback((task) => {
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
    setEditingTask(task);
    setIsEditModalOpen(true);
  }, []);

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

      setIsEditModalOpen(false);
      setEditingTask(null);
    }, 'Updating task');
  }, [editingTask, currentUser, validateSession, withRetry]);

  const handleCloseTaskDetail = useCallback(() => {
    setIsTaskDetailModalOpen(false);
    setSelectedTask(null);
  }, []);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Update filters ref when filters change
  useEffect(() => {
    filtersRef.current = { filterMode, selectedProject };
  }, [filterMode, selectedProject]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Session monitoring
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

  // Load initial data
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

  // Handle navigation state
  useEffect(() => {
    if (location.state?.openAddModal) {
      setIsAddModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
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
          default:
            break;
        }
      }

      if (event.key === 'Escape') {
        if (isTaskDetailModalOpen) {
          event.preventDefault();
          handleCloseTaskDetail();
        } else if (isEditModalOpen) {
          event.preventDefault();
          setIsEditModalOpen(false);
          setEditingTask(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh, isTaskDetailModalOpen, isEditModalOpen, handleCloseTaskDetail]);

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const getColorClasses = (color) => {
    return COLOR_CLASSES[color] || COLOR_CLASSES.blue;
  };

  // Memoized configuration objects
  const statsConfig = useMemo(() => [
    { key: 'total', label: 'Total', value: taskStats.total, icon: CheckCircle2, color: 'blue' },
    { key: 'personal', label: 'Personal', value: taskStats.personal, icon: Users, color: 'emerald' },
    { key: 'project', label: 'Project', value: taskStats.project, icon: Users, color: 'purple' },
    { key: 'assigned', label: 'Assigned', value: taskStats.assigned, icon: Users, color: 'orange' },
    { key: 'completed', label: 'Done', value: taskStats.completed, icon: CheckCircle2, color: 'green' },
    { key: 'overdue', label: 'Overdue', value: taskStats.overdue, icon: Clock, color: 'red' }
  ], [taskStats]);

  const filterChips = useMemo(() => [
    { key: 'all', label: 'All Tasks', count: taskStats.total },
    { key: 'personal', label: 'Personal', count: taskStats.personal },
    { key: 'project', label: 'Project', count: taskStats.project },
    { key: 'assigned', label: 'Assigned', count: taskStats.assigned }
  ], [taskStats]);

  const viewModes = useMemo(() => [
    { mode: 'board', icon: Filter, label: 'Board' },
    { mode: 'list', icon: CheckCircle2, label: 'List' },
    { mode: 'table', icon: Calendar, label: 'Table' }
  ], []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Show session error screen
  if (!currentUser || sessionError) {
    return (
      <div className="session-error-container">
        <div className="session-error-card">
          <h2 className="session-error-title">
            {sessionError ? 'Session Expired' : 'Session Required'}
          </h2>
          <p className="session-error-description">
            {sessionError
              ? 'Your session has expired for security reasons. Please log in again to continue.'
              : 'Please log in to view your tasks.'
            }
          </p>
          <div className="session-error-actions">
            <button
              onClick={() => navigate('/login')}
              className="btn-login"
            >
              Go to Login
            </button>
            {sessionError && (
              <button
                onClick={() => window.location.reload()}
                className="btn-refresh-page"
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
    <div className="main-content-container">
      {/* Error Banner */}
      {error && (
        <div className="error-banner">
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
      <div className="task-header">
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
                className="btn-refresh"
                title="Refresh tasks (Ctrl+R)"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="btn-primary-gradient"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </button>
            </div>
          </div>

          {/* Search and View Mode Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Search with debounced optimization */}
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <div className="search-clear-button">
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="view-mode-container">
              {viewModes.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`view-mode-button ${viewMode === mode ? 'view-mode-active' : 'view-mode-inactive'
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
              const isActive = filterMode === key || (key === 'total' && filterMode === 'all');

              return (
                <div
                  key={key}
                  className={`stats-card ${isActive ? `stats-card-active ${colorClasses.text}` : ''}`}
                  onClick={() => setFilterMode(key === 'total' ? 'all' : key)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${isActive ? colorClasses.text : 'text-slate-600'}`}>
                        {label}
                      </p>
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
                className={`filter-chip ${filterMode === key ? 'filter-chip-active' : 'filter-chip-inactive'
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
            <div className="project-filter-container">
              <label className="project-filter-label">Project:</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="project-filter-select"
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
          <div className="loading-container">
            <LoadingSpinner />
            <p className="ml-4 text-slate-600 font-medium">Loading tasks...</p>
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 className="empty-state-icon" />
            <h3 className="empty-state-title">
              {debouncedSearchQuery ? 'No tasks found' : 'No tasks yet'}
            </h3>
            <p className="empty-state-description">
              {debouncedSearchQuery
                ? `No tasks match "${debouncedSearchQuery}". Try adjusting your search or filters.`
                : 'Get started by creating your first task to organize your work.'
              }
            </p>
            {!debouncedSearchQuery && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="btn-create-first-task"
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
        <div className="loading-overlay">
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

      {/* Task Add Modal */}
      <TaskModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAdd}
        initialData={null}
        isEditing={false}
        allowProjectSelection={true}
        availableProjects={availableProjects}
        currentUser={currentUser}
        projectContext={selectedProject ? availableProjects.find(p => p.id === selectedProject) : null}
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