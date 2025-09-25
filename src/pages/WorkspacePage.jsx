// src/pages/WorkspacePage.jsx - Production Ready with Enhanced Session Management
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Users, Folder, CheckCircle, Clock, AlertCircle, FileText, BarChart3, Plus, UserPlus, RefreshCw } from 'lucide-react';
import ProjectModal from '../components/common/modal/ProjectModal.jsx';
import EditProjectModal from '../components/common/modal/EditProjectModal.jsx';
import ProjectSelectionModal from '../components/common/modal/ProjectSelectionModal.jsx';
import InviteTeamMemberModal from '../components/common/modal/InviteTeamMemberModal.jsx';
import TaskModal from '../components/common/modal/TaskModal.jsx';
import {
    StatCard,
    ProjectsSection,
    TeamSection,
    QuickActions,
    ActivityItem
} from '../components/workspace';

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
 * Configuration for retry operations and performance
 */
const CONFIG = {
    MAX_RETRIES: 2,
    RETRY_DELAY: 1000,
    SESSION_REFRESH_DELAY: 3000,
    DATA_REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_RECENT_PROJECTS: 5,
    MAX_RECENT_ACTIVITIES: 10
};

/**
 * Default workspace data structure
 */
const DEFAULT_WORKSPACE_DATA = {
    stats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        teamMembers: 0,
        pendingTasks: 0,
        overdueTasks: 0
    },
    projects: [],
    teamMembers: [],
    recentActivity: []
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WorkspacePage({ currentUser, onAuthStateChange }) {
    // ========================================================================
    // HOOKS AND STATE
    // ========================================================================
    
    const navigate = useNavigate();
    
    // Core state
    const [workspaceData, setWorkspaceData] = useState(DEFAULT_WORKSPACE_DATA);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    
    // Modal states
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isProjectSelectionModalOpen, setIsProjectSelectionModalOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    
    // Modal data states
    const [editingProject, setEditingProject] = useState(null);
    const [selectedProjectForInvite, setSelectedProjectForInvite] = useState(null);
    
    // Session management
    const [sessionError, setSessionError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    
    // Refs for cleanup and stable references
    const timeoutRefs = useRef(new Set());
    const abortControllerRef = useRef(new AbortController());
    const subscriptionRef = useRef(null);
    const refreshIntervalRef = useRef(null);
    const lastRefreshRef = useRef(0);

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Cleanup function for timeouts, subscriptions, and abort controllers
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
        
        // Unsubscribe from real-time updates
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
        }
        
        // Clear refresh interval
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
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
        maxRetries = CONFIG.MAX_RETRIES
    ) => {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.error(`${operationName} attempt ${attempt + 1} failed:`, error);
                
                // Don't retry on the last attempt
                if (attempt === maxRetries) break;
                
                // Check if this is a retryable error
                if (error.message?.includes('JWT') || 
                    error.message?.includes('auth') || 
                    error.code === 'PGRST301' ||
                    error.name === 'AbortError') {
                    
                    // Wait before retry with exponential backoff
                    const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt);
                    await new Promise(resolve => safeSetTimeout(resolve, delay));
                } else {
                    // Non-retryable error, fail immediately
                    break;
                }
            }
        }
        
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

        // Handle AbortError gracefully
        if (error.name === 'AbortError') {
            console.log(`${operation} was cancelled`);
            return;
        }

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
                }, CONFIG.SESSION_REFRESH_DELAY);
                return;
            }

            // Session is valid but we still got an auth error
            if (retryCount < CONFIG.MAX_RETRIES) {
                setRetryCount(prev => prev + 1);
                return;
            }
        }

        // Set user-friendly error message
        const userMessage = error.message?.includes('network') 
            ? 'Network error. Please check your connection and try again.'
            : `${operation} failed. Please try again.`;
        
        setError(userMessage);
    }, [validateSession, navigate, retryCount, safeSetTimeout]);

    // ========================================================================
    // DATA LOADING FUNCTIONS
    // ========================================================================

    /**
     * Calculates project progress based on task completion
     */
    const calculateProjectProgress = useCallback(async (projectId) => {
        try {
            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('status')
                .eq('project_id', projectId)
                .abortSignal(abortControllerRef.current.signal);

            if (error) throw error;

            const total = tasks.length;
            const completed = tasks.filter(t => t.status === 'completed').length;
            return total > 0 ? Math.round((completed / total) * 100) : 0;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error calculating project progress:', error);
            }
            return 0;
        }
    }, []);

    /**
     * Calculates completed tasks for a project
     */
    const calculateCompletedTasks = useCallback(async (projectId) => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('id', { count: 'exact' })
                .eq('project_id', projectId)
                .eq('status', 'completed')
                .abortSignal(abortControllerRef.current.signal);

            if (error) throw error;
            return data.length;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error calculating completed tasks:', error);
            }
            return 0;
        }
    }, []);

    /**
     * Loads projects with enhanced error handling and performance
     */
    const loadProjects = useCallback(async (userId) => {
        if (!userId) return [];

        return await withRetry(async () => {
            console.log('Loading projects for user:', userId);

            // STEP 1: Get user memberships
            const { data: membershipData, error: membershipError } = await supabase
                .from('project_members')
                .select('project_id, role')
                .eq('user_id', userId)
                .abortSignal(abortControllerRef.current.signal);
            
            if (membershipError) throw membershipError;

            if (!membershipData || membershipData.length === 0) {
                console.log('User is not a member of any projects');
                return [];
            }

            const accessibleProjectIds = membershipData.map(m => m.project_id);

            // STEP 2: Get projects data with task counts
            const { data: projectsData, error: projectsError } = await supabase
                .from('projects')
                .select(`
                    id,
                    name,
                    description,
                    status,
                    deadline,
                    created_at,
                    user_id
                `)
                .in('id', accessibleProjectIds)
                .order('created_at', { ascending: false })
                .limit(CONFIG.MAX_RECENT_PROJECTS)
                .abortSignal(abortControllerRef.current.signal);

            if (projectsError) throw projectsError;
            if (!projectsData || projectsData.length === 0) return [];

            // STEP 3: Get task counts for all projects in batch
            const { data: taskCounts, error: taskCountsError } = await supabase
                .from('tasks')
                .select('project_id, status')
                .in('project_id', projectsData.map(p => p.id))
                .abortSignal(abortControllerRef.current.signal);

            if (taskCountsError) throw taskCountsError;

            // STEP 4: Get team members for all projects efficiently
            let allTeamMembersData = [];
            try {
                const { data: teamMembersRaw, error: teamMembersError } = await supabase
                    .rpc('get_project_team_members', { 
                        project_ids: projectsData.map(p => p.id) 
                    })
                    .abortSignal(abortControllerRef.current.signal);

                if (!teamMembersError && teamMembersRaw) {
                    allTeamMembersData = teamMembersRaw;
                } else {
                    // Fallback method
                    const { data: basicMembersData, error: basicError } = await supabase
                        .from('project_members')
                        .select(`
                            project_id, 
                            role, 
                            user_id,
                            profiles:user_id (
                                id,
                                name,
                                email,
                                avatar_url
                            )
                        `)
                        .in('project_id', projectsData.map(p => p.id))
                        .abortSignal(abortControllerRef.current.signal);

                    if (!basicError && basicMembersData) {
                        allTeamMembersData = basicMembersData.map(member => ({
                            project_id: member.project_id,
                            role: member.role,
                            user_id: member.user_id,
                            user_name: member.profiles?.name || 'Unknown User',
                            user_email: member.profiles?.email || '',
                            user_avatar_url: member.profiles?.avatar_url || null
                        }));
                    }
                }
            } catch (error) {
                console.warn('Failed to load team members:', error);
                // Continue without team members data
            }

            // STEP 5: Process data efficiently
            const taskCountsByProject = {};
            const completedTasksByProject = {};

            taskCounts?.forEach(task => {
                if (!taskCountsByProject[task.project_id]) {
                    taskCountsByProject[task.project_id] = 0;
                    completedTasksByProject[task.project_id] = 0;
                }
                taskCountsByProject[task.project_id]++;
                if (task.status === 'completed') {
                    completedTasksByProject[task.project_id]++;
                }
            });

            const teamMembersByProject = {};
            allTeamMembersData?.forEach(member => {
                if (!member?.project_id) return;
                
                if (!teamMembersByProject[member.project_id]) {
                    teamMembersByProject[member.project_id] = [];
                }

                teamMembersByProject[member.project_id].push({
                    id: member.user_id,
                    name: member.user_name || member.user?.name || 'Unknown User',
                    email: member.user_email || member.user?.email || '',
                    avatar_url: member.user_avatar_url || member.user?.avatar_url || null,
                    role: member.role || 'member'
                });
            });

            const userRolesByProject = {};
            membershipData.forEach(membership => {
                if (membership?.project_id) {
                    userRolesByProject[membership.project_id] = membership.role;
                }
            });

            // STEP 6: Build final project objects
            const processedProjects = projectsData.map(project => {
                const totalTasks = taskCountsByProject[project.id] || 0;
                const completedTasks = completedTasksByProject[project.id] || 0;
                const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                
                return {
                    id: project.id,
                    name: project.name || 'Untitled Project',
                    description: project.description || '',
                    progress: progress,
                    status: project.status || 'planned',
                    deadline: project.deadline || null,
                    totalTasks: totalTasks,
                    completedTasks: completedTasks,
                    teamMembers: teamMembersByProject[project.id] || [],
                    isOwner: project.user_id === userId,
                    userRole: userRolesByProject[project.id] || 'member'
                };
            });

            console.log(`Loaded ${processedProjects.length} projects successfully`);
            return processedProjects;

        }, 'Loading projects');
    }, [withRetry]);

    /**
     * Loads team members data
     */
    const loadTeamMembers = useCallback(async (userId) => {
        return await withRetry(async () => {
            // For now, return current user as team member
            // This can be expanded when implementing proper team management
            return [{
                id: userId,
                name: currentUser?.name || currentUser?.email || "You",
                role: "Owner",
                status: "online",
                avatar_url: currentUser?.avatar_url || null
            }];
        }, 'Loading team members');
    }, [withRetry, currentUser]);

    /**
     * Loads tasks data for statistics
     */
    const loadTasks = useCallback(async (userId) => {
        return await withRetry(async () => {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .abortSignal(abortControllerRef.current.signal);

            if (error) throw error;
            return data || [];
        }, 'Loading tasks');
    }, [withRetry]);

    /**
     * Loads recent activity data
     */
    const loadRecentActivity = useCallback(async (userId) => {
        return await withRetry(async () => {
            const { data: recentTasks, error } = await supabase
                .from('tasks')
                .select('id, title, updated_at, status, created_at')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(CONFIG.MAX_RECENT_ACTIVITIES)
                .abortSignal(abortControllerRef.current.signal);

            if (error) throw error;

            return (recentTasks || []).map((task, index) => ({
                id: `activity-${task.id}-${index}`,
                user: "You",
                action: task.created_at === task.updated_at 
                    ? `created task '${task.title}'`
                    : `updated task '${task.title}'`,
                timestamp: task.updated_at,
                icon: CheckCircle
            }));
        }, 'Loading recent activity');
    }, [withRetry]);

    // ========================================================================
    // MAIN DATA LOADING FUNCTION
    // ========================================================================

    /**
     * Main function to load all workspace data
     */
    const loadWorkspaceData = useCallback(async (force = false) => {
        if (!currentUser?.id) return;

        // Prevent too frequent refreshes
        const now = Date.now();
        if (!force && now - lastRefreshRef.current < 5000) {
            console.log('Skipping refresh - too recent');
            return;
        }
        lastRefreshRef.current = now;

        // Validate session first
        const sessionValid = await validateSession();
        if (!sessionValid) return;

        const isInitialLoad = !workspaceData.projects.length;
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }
        
        setError(null);

        try {
            // Load all data in parallel for better performance
            const [projectsData, teamData, tasksData, activityData] = await Promise.all([
                loadProjects(currentUser.id),
                loadTeamMembers(currentUser.id),
                loadTasks(currentUser.id),
                loadRecentActivity(currentUser.id)
            ]);

            const stats = calculateStats(projectsData, tasksData, teamData);

            setWorkspaceData({
                stats,
                projects: projectsData,
                teamMembers: teamData,
                recentActivity: activityData
            });

        } catch (error) {
            await handleApiError(error, 'Loading workspace data');
            
            // On error, keep existing data if available
            if (!workspaceData.projects.length) {
                setWorkspaceData(DEFAULT_WORKSPACE_DATA);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [
        currentUser?.id, 
        validateSession, 
        loadProjects, 
        loadTeamMembers, 
        loadTasks, 
        loadRecentActivity, 
        handleApiError,
        workspaceData.projects.length
    ]);

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================

    /**
     * Calculates workspace statistics
     */
    const calculateStats = useCallback((projects, tasks, teamMembers) => {
        const now = new Date();
        const overdueTasks = tasks.filter(task =>
            task.due_date && 
            new Date(task.due_date) < now && 
            task.status !== 'completed'
        ).length;

        return {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'in-progress').length,
            completedProjects: projects.filter(p => p.status === 'completed').length,
            teamMembers: teamMembers.length,
            pendingTasks: tasks.filter(t => t.status !== 'completed').length,
            overdueTasks: overdueTasks
        };
    }, []);

    // ========================================================================
    // MODAL HANDLERS
    // ========================================================================

    /**
     * Handles team member invitation flow
     */
    const handleInviteTeamMember = useCallback(() => {
        if (workspaceData.projects.length === 0) {
            setError('Please create a project first before inviting team members.');
            setIsProjectModalOpen(true);
        } else if (workspaceData.projects.length === 1) {
            // If only one project, open invite modal directly for that project
            setSelectedProjectForInvite(workspaceData.projects[0].id);
            setShowInviteModal(true);
        } else {
            // If multiple projects, open project selection modal
            setIsProjectSelectionModalOpen(true);
        }
    }, [workspaceData.projects]);

    /**
     * Handles task creation modal opening
     */
    const handleOpenTaskModal = useCallback(() => {
        if (workspaceData.projects.length === 0) {
            setError('Please create a project first before adding tasks.');
            setIsProjectModalOpen(true);
        } else {
            setIsTaskModalOpen(true);
        }
    }, [workspaceData.projects.length]);

    /**
     * Handles project selection for inviting team members
     */
    const handleProjectSelectForInvite = useCallback((projectId) => {
        setSelectedProjectForInvite(projectId);
        setIsProjectSelectionModalOpen(false);
        setShowInviteModal(true);
    }, []);

    // ========================================================================
    // CRUD OPERATIONS
    // ========================================================================

    /**
     * Handles project creation
     */
    const handleProjectCreated = useCallback(async (newProject) => {
        // Optimistic update
        setWorkspaceData(prev => ({
            ...prev,
            projects: [{
                id: newProject.id,
                name: newProject.name,
                description: newProject.description,
                progress: newProject.progress || 0,
                status: newProject.status,
                deadline: newProject.deadline,
                totalTasks: 0,
                completedTasks: 0,
                teamMembers: [],
                isOwner: true,
                userRole: 'owner'
            }, ...prev.projects],
            stats: {
                ...prev.stats,
                totalProjects: prev.stats.totalProjects + 1,
                activeProjects: newProject.status === 'in-progress' 
                    ? prev.stats.activeProjects + 1 
                    : prev.stats.activeProjects
            }
        }));

        // Refresh data to ensure consistency
        safeSetTimeout(() => loadWorkspaceData(true), 1000);
    }, [loadWorkspaceData, safeSetTimeout]);

    /**
     * Handles project editing
     */
    const handleEditProject = useCallback((project) => {
        setEditingProject(project);
        setIsEditModalOpen(true);
    }, []);

    /**
     * Handles project updates
     */
    const handleProjectUpdated = useCallback(async (updatedProject) => {
        // Optimistic update
        setWorkspaceData(prev => ({
            ...prev,
            projects: prev.projects.map(project =>
                project.id === updatedProject.id
                    ? {
                        ...project,
                        name: updatedProject.name,
                        description: updatedProject.description,
                        status: updatedProject.status,
                        deadline: updatedProject.deadline
                    }
                    : project
            )
        }));
        
        setIsEditModalOpen(false);
        setEditingProject(null);

        // Refresh data to ensure consistency
        safeSetTimeout(() => loadWorkspaceData(true), 1000);
    }, [loadWorkspaceData, safeSetTimeout]);

    /**
     * Handles project deletion with cascade
     */
    const handleDeleteProject = useCallback(async (projectId) => {
        const project = workspaceData.projects.find(p => p.id === projectId);
        if (!project) return;

        const confirmMessage = `Are you sure you want to delete "${project.name}"? This will permanently delete all tasks, files, and team memberships associated with this project. This action cannot be undone.`;
        
        if (!window.confirm(confirmMessage)) return;

        setLoading(true);
        setError(null);

        try {
            await withRetry(async () => {
                // STEP 1: Delete all project files from storage
                const { data: files, error: filesError } = await supabase
                    .from('project_attachments')
                    .select('file_path')
                    .eq('project_id', projectId)
                    .abortSignal(abortControllerRef.current.signal);

                if (!filesError && files?.length > 0) {
                    const filePaths = files.map(file => file.file_path);
                    await supabase.storage
                        .from('project-files')
                        .remove(filePaths);
                }

                // STEP 2: Delete in order due to foreign key constraints
                const deleteOperations = [
                    // Delete file records
                    supabase
                        .from('project_attachments')
                        .delete()
                        .eq('project_id', projectId),
                    
                    // Delete tasks
                    supabase
                        .from('tasks')
                        .delete()
                        .eq('project_id', projectId),
                    
                    // Delete project members
                    supabase
                        .from('project_members')
                        .delete()
                        .eq('project_id', projectId),
                    
                    // Delete project
                    supabase
                        .from('projects')
                        .delete()
                        .eq('id', projectId)
                ];

                for (const operation of deleteOperations) {
                    const { error } = await operation.abortSignal(abortControllerRef.current.signal);
                    if (error) throw error;
                }
            }, 'Deleting project');

            // Update state to remove the deleted project
            setWorkspaceData(prev => ({
                ...prev,
                projects: prev.projects.filter(p => p.id !== projectId),
                stats: {
                    ...prev.stats,
                    totalProjects: prev.stats.totalProjects - 1,
                    activeProjects: project.status === 'in-progress'
                        ? Math.max(0, prev.stats.activeProjects - 1)
                        : prev.stats.activeProjects
                }
            }));

            // Show success message
            setError(null);
            
        } catch (error) {
            await handleApiError(error, 'Deleting project');
        } finally {
            setLoading(false);
        }
    }, [workspaceData.projects, withRetry, handleApiError]);

    /**
     * Handles task creation
     */
    const handleCreateTask = useCallback(async (taskData) => {
        if (!currentUser?.id) {
            setError('User session expired. Please refresh the page.');
            return;
        }

        const sessionValid = await validateSession();
        if (!sessionValid) return;

        try {
            await withRetry(async () => {
                const backendTask = {
                    title: taskData.title,
                    description: taskData.description || "",
                    status: STATUS_MAP[taskData.status] || "pending",
                    priority: taskData.priority || "medium",
                    due_date: taskData.dueDate || null,
                    start_time: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
                    end_time: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
                    all_day: taskData.allDay || false,
                    user_id: currentUser.id,
                    created_by: currentUser.id,
                    project_id: taskData.projectId || null,
                    assigned_to: taskData.assignedTo || null
                };

                const { data, error } = await supabase
                    .from('tasks')
                    .insert([backendTask])
                    .select()
                    .single()
                    .abortSignal(abortControllerRef.current.signal);

                if (error) throw error;

                setIsTaskModalOpen(false);
                
                // Refresh workspace data to update statistics
                safeSetTimeout(() => loadWorkspaceData(true), 1000);
            }, 'Creating task');
        } catch (error) {
            await handleApiError(error, 'Creating task');
        }
    }, [currentUser, validateSession, withRetry, handleApiError, loadWorkspaceData, safeSetTimeout]);

    /**
     * Handles successful team member addition
     */
    const handleMemberAdded = useCallback(() => {
        setShowInviteModal(false);
        setSelectedProjectForInvite(null);
        
        // Refresh data to show new team member
        safeSetTimeout(() => loadWorkspaceData(true), 1000);
    }, [loadWorkspaceData, safeSetTimeout]);

    /**
     * Manual refresh function
     */
    const handleRefresh = useCallback(async () => {
        setError(null);
        await loadWorkspaceData(true);
    }, [loadWorkspaceData]);

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
     * Initial data loading
     */
    useEffect(() => {
        if (currentUser?.id && !sessionError) {
            loadWorkspaceData();
        }
    }, [currentUser?.id, sessionError, loadWorkspaceData]);

    /**
     * Set up real-time subscriptions
     */
    useEffect(() => {
        if (!currentUser?.id || sessionError) return;

        try {
            subscriptionRef.current = supabase
                .channel('workspace-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'projects' },
                    (payload) => {
                        console.log('Project change detected:', payload.eventType);
                        safeSetTimeout(() => loadWorkspaceData(true), 2000);
                    }
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'project_members' },
                    (payload) => {
                        console.log('Project member change detected:', payload.eventType);
                        safeSetTimeout(() => loadWorkspaceData(true), 2000);
                    }
                )
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'tasks' },
                    (payload) => {
                        console.log('Task change detected:', payload.eventType);
                        safeSetTimeout(() => loadWorkspaceData(true), 2000);
                    }
                )
                .subscribe();

        } catch (error) {
            console.error('Failed to set up real-time subscriptions:', error);
        }

        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
            }
        };
    }, [currentUser?.id, sessionError, loadWorkspaceData, safeSetTimeout]);

    /**
     * Set up periodic data refresh
     */
    useEffect(() => {
        if (!currentUser?.id || sessionError) return;

        refreshIntervalRef.current = setInterval(() => {
            loadWorkspaceData(false); // Non-forced refresh
        }, CONFIG.DATA_REFRESH_INTERVAL);

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
        };
    }, [currentUser?.id, sessionError, loadWorkspaceData]);

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
                        setIsProjectModalOpen(true);
                        break;
                    case 't':
                        event.preventDefault();
                        handleOpenTaskModal();
                        break;
                    case 'i':
                        event.preventDefault();
                        handleInviteTeamMember();
                        break;
                    case 'r':
                        event.preventDefault();
                        handleRefresh();
                        break;
                    default:
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleOpenTaskModal, handleInviteTeamMember, handleRefresh]);

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
                            : 'Please log in to view your workspace.'
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
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-red-800 text-sm font-medium">{error}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRefresh}
                                disabled={loading || refreshing}
                                className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 font-medium transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
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
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Workspace Dashboard</h1>
                    <p className="text-gray-600 mt-2">Welcome to your team collaboration hub</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="inline-flex items-center px-3 py-2 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                        title="Refresh workspace (Ctrl+R)"
                    >
                        <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <LoadingSpinner />
                    <p className="ml-4 text-slate-600 font-medium">Loading workspace...</p>
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            title="Total Projects"
                            value={workspaceData.stats.totalProjects}
                            icon={<Folder className="w-6 h-6 text-blue-600" />}
                            trend="+2 this month"
                        />
                        <StatCard
                            title="Active Projects"
                            value={workspaceData.stats.activeProjects}
                            icon={<BarChart3 className="w-6 h-6 text-green-600" />}
                        />
                        <StatCard
                            title="Team Members"
                            value={workspaceData.stats.teamMembers}
                            icon={<Users className="w-6 h-6 text-purple-600" />}
                            trend="+3 recently"
                        />
                        <StatCard
                            title="Pending Tasks"
                            value={workspaceData.stats.pendingTasks}
                            icon={<Clock className="w-6 h-6 text-orange-600" />}
                            trend={`${workspaceData.stats.overdueTasks} overdue`}
                            trendColor={workspaceData.stats.overdueTasks > 0 ? 'text-red-600' : 'text-green-600'}
                        />
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Projects Section */}
                        <ProjectsSection
                            projects={workspaceData.projects}
                            onEditProject={handleEditProject}
                            onDeleteProject={handleDeleteProject}
                            onTaskCreated={() => loadWorkspaceData(true)}
                            loading={refreshing}
                        />

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Team Section */}
                            <TeamSection 
                                teamMembers={workspaceData.teamMembers}
                                loading={refreshing}
                            />

                            {/* Quick Actions */}
                            <QuickActions
                                onCreateProject={() => setIsProjectModalOpen(true)}
                                onInviteTeamMember={handleInviteTeamMember}
                                onCreateTask={handleOpenTaskModal}
                                disabled={loading || refreshing}
                            />

                            {/* Recent Activity */}
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
                                    {refreshing && (
                                        <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {workspaceData.recentActivity.length > 0 ? (
                                        workspaceData.recentActivity.map(activity => (
                                            <ActivityItem key={activity.id} activity={activity} />
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm py-4 text-center">
                                            No recent activity to display
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Loading Overlay for Non-blocking Operations */}
            {refreshing && workspaceData.projects.length > 0 && (
                <div className="fixed top-4 right-4 bg-white border border-slate-200 rounded-lg p-3 shadow-lg z-50">
                    <div className="flex items-center gap-3">
                        <LoadingSpinner />
                        <span className="text-sm text-slate-600 font-medium">Refreshing workspace...</span>
                    </div>
                </div>
            )}

            {/* MODALS */}
            <ProjectModal
                open={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
                onProjectCreated={handleProjectCreated}
            />

            <EditProjectModal
                open={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingProject(null);
                }}
                project={editingProject}
                onProjectUpdated={handleProjectUpdated}
            />

            <TaskModal
                open={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                onSubmit={handleCreateTask}
                allowProjectSelection={true}
                isEditing={false}
                availableProjects={workspaceData.projects}
                currentUser={currentUser}
            />

            <ProjectSelectionModal
                open={isProjectSelectionModalOpen}
                onClose={() => setIsProjectSelectionModalOpen(false)}
                onProjectSelected={handleProjectSelectForInvite}
                projects={workspaceData.projects}
            />

            <InviteTeamMemberModal
                isOpen={showInviteModal}
                onClose={() => {
                    setShowInviteModal(false);
                    setSelectedProjectForInvite(null);
                }}
                projectId={selectedProjectForInvite}
                projects={workspaceData.projects}
                onMemberAdded={handleMemberAdded}
            />
        </div>
    );
}