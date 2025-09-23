// src/pages/WorkspacePage.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Users, Folder, CheckCircle, Clock, AlertCircle, FileText, BarChart3 } from 'lucide-react';
import ProjectModal from '../components/common/modal/ProjectModal.jsx';
import EditProjectModal from '../components/common/modal/EditProjectModal.jsx';
import ProjectSelectionModal from '../components/common/modal/ProjectSelectionModal.jsx';
import InviteTeamMemberModal from '../components/common/modal/InviteTeamMemberModal.jsx';
import TaskModal from '../components/common/modal/TaskModal.jsx';
import ProjectTaskButton from '../components/workspace/ProjectTaskButton.jsx';
import { Plus, UserPlus } from 'lucide-react';
import {
    StatCard,
    ProjectsSection,
    TeamSection,
    QuickActions,
    ActivityItem
} from '../components/workspace';

export default function WorkspacePage() {
    const [loading, setLoading] = useState(true);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // New state for edit modal
    const [isProjectSelectionModalOpen, setIsProjectSelectionModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null); // State to hold project being edited
    const [selectedProjectForInvite, setSelectedProjectForInvite] = useState(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    const [workspaceData, setWorkspaceData] = useState({
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
    });

    const statusMap = {
        "todo": "pending",
        "progress": "in-progress",
        "complete": "completed"
    };

    useEffect(() => {
        loadWorkspaceData();

        const subscription = supabase
            .channel('projects-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'projects' },
                (payload) => {
                    console.log('Project change detected:', payload);
                    loadWorkspaceData();
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'project_members' },
                (payload) => {
                    console.log('Project member change detected:', payload);
                    loadWorkspaceData();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleInviteTeamMember = () => {
        if (workspaceData.projects.length === 0) {
            alert('Please create a project first before inviting team members.');
            setIsProjectModalOpen(true);
        } else if (workspaceData.projects.length === 1) {
            // If only one project, open invite modal directly for that project
            setSelectedProjectForInvite(workspaceData.projects[0].id);
            setShowInviteModal(true);
        } else {
            // If multiple projects, open project selection modal
            setIsProjectSelectionModalOpen(true);
            // return null;
        }
    }

    const handleOpenTaskModal = () => {
        if (workspaceData.projects.length === 0) {
            alert('Please create a project first before adding tasks.');
            setIsProjectModalOpen(true);
        } else {
            setIsTaskModalOpen(true);
        }
    };

    const handleProjectSelectForInvite = (projectId) => {
        setSelectedProjectForInvite(projectId);
        setIsProjectSelectionModalOpen(false);
        setShowInviteModal(true);
    }

    const handleMemberAdded = () => {
        setShowInviteModal(false);
        setSelectedProjectForInvite(null);
        // Optionally refresh team members or show a success message
        loadWorkspaceData();
    }

    const loadWorkspaceData = async () => {
        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error('No user logged in');

            // Load all data in parallel
            const [projectsData, teamData, tasksData, activityData] = await Promise.all([
                loadProjects(user.id),
                loadTeamMembers(user.id),
                loadTasks(user.id),
                loadRecentActivity(user.id)
            ]);

            setWorkspaceData({
                stats: calculateStats(projectsData, tasksData, teamData),
                projects: projectsData,
                teamMembers: teamData,
                recentActivity: activityData
            });

        } catch (error) {
            console.error("Failed to load workspace data:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadProjects = async (userId) => {
        try {
            console.log('Loading projects for user:', userId);

            // STEP 1: Get user memberships
            const { data: membershipData, error: membershipError } = await supabase
                .from('project_members')
                .select('project_id, role')
                .eq('user_id', userId);
            console.log('membership data:', membershipData);
                

            if (membershipError) {
                console.error('Error fetching user memberships:', membershipError);
                throw membershipError;
            }

            if (!membershipData || membershipData.length === 0) {
                console.log('User is not a member of any projects');
                return [];
            }

            const accessibleProjectIds = membershipData.map(m => m.project_id);

            // STEP 2: Get projects data
            const { data, error } = await supabase
                .from('projects')
                .select(`
                    id,
                    name,
                    description,
                    status,
                    deadline,
                    created_at,
                    user_id,
                    tasks:tasks(count)
                `)
                .in('id', accessibleProjectIds)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) {
                console.error('Error fetching projects:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                return [];
            }

            const projectIds = data.map(p => p.id);

            // STEP 3: Use a direct SQL query to get all team members for these projects
            // This bypasses RLS issues by using a direct query
            const { data: allTeamMembersRaw, error: teamMembersError } = await supabase
                .rpc('get_project_team_members', { project_ids: projectIds });

            let allTeamMembersData = [];

            if (!teamMembersError && allTeamMembersRaw) {
                allTeamMembersData = allTeamMembersRaw;
                console.log('Successfully loaded team members via RPC:', allTeamMembersData.length);
            } else {
                console.log('RPC failed, using fallback method...');

                // Fallback: Try the basic approach without joins
                const { data: basicMembersData, error: basicError } = await supabase
                    .from('project_members')
                    .select('project_id, role, user_id')
                    .in('project_id', projectIds);

                if (!basicError && basicMembersData) {
                    // Get all unique user IDs
                    const allUserIds = [...new Set(basicMembersData.map(m => m.user_id))];

                    // Get profiles for all users
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, name, email, avatar_url')
                        .in('id', allUserIds);

                    // Create profiles map
                    const profilesMap = {};
                    if (!profilesError && profilesData) {
                        profilesData.forEach(profile => {
                            profilesMap[profile.id] = profile;
                        });
                    }

                    // Combine member data with profile data
                    allTeamMembersData = basicMembersData.map(member => ({
                        project_id: member.project_id,
                        role: member.role,
                        user_id: member.user_id,
                        user_name: profilesMap[member.user_id]?.name || 'Unknown User',
                        user_email: profilesMap[member.user_id]?.email || '',
                        user_avatar_url: profilesMap[member.user_id]?.avatar_url || null
                    }));
                }
            }

            console.log('Final all team members data:', allTeamMembersData);

            // Organize team members by project
            const teamMembersByProject = {};
            if (allTeamMembersData && Array.isArray(allTeamMembersData)) {
                allTeamMembersData.forEach(member => {
                    if (!member || !member.project_id) {
                        console.warn('Skipping invalid member data:', member);
                        return;
                    }

                    if (!teamMembersByProject[member.project_id]) {
                        teamMembersByProject[member.project_id] = [];
                    }

                    // Handle both RPC format and fallback format
                    const memberId = member.user_id;
                    const memberName = member.user_name || member.user?.name || 'Unknown User';
                    const memberEmail = member.user_email || member.user?.email || '';
                    const memberAvatar = member.user_avatar_url || member.user?.avatar_url || null;
                    const memberRole = member.role || 'member';

                    if (memberId) {
                        teamMembersByProject[member.project_id].push({
                            id: memberId,
                            name: memberName,
                            email: memberEmail,
                            avatar_url: memberAvatar,
                            role: memberRole
                        });
                    }
                });
            }

            // Log team counts for debugging
            console.log('Team members by project:',
                Object.keys(teamMembersByProject).map(projectId => ({
                    projectId,
                    memberCount: teamMembersByProject[projectId]?.length || 0,
                    members: teamMembersByProject[projectId]?.map(m => ({ name: m.name, role: m.role }))
                }))
            );

            // Create user role lookup
            const userRolesByProject = {};
            membershipData.forEach(membership => {
                if (membership && membership.project_id) {
                    userRolesByProject[membership.project_id] = membership.role;
                }
            });

            // STEP 4: Process the projects
            const processedProjects = await Promise.all(
                data.map(async (project) => {
                    try {
                        const progress = await calculateProjectProgress(project);
                        const completedTasks = await calculateCompletedTasks(project.id);

                        const teamMembersForThisProject = teamMembersByProject[project.id] || [];

                        console.log(`Project ${project.name}: ${teamMembersForThisProject.length} team members`);

                        return {
                            id: project.id,
                            name: project.name || 'Untitled Project',
                            description: project.description || '',
                            progress: progress || 0,
                            status: project.status || 'planned',
                            deadline: project.deadline || null,
                            totalTasks: project.tasks?.[0]?.count || 0,
                            completedTasks: completedTasks || 0,
                            teamMembers: teamMembersForThisProject,
                            isOwner: project.user_id === userId,
                            userRole: userRolesByProject[project.id] || 'member'
                        };
                    } catch (projectError) {
                        console.error('Error processing project:', project.id, projectError);
                        return {
                            id: project.id,
                            name: project.name || 'Error Loading Project',
                            description: 'Error loading project details',
                            progress: 0,
                            status: 'planned',
                            deadline: null,
                            totalTasks: 0,
                            completedTasks: 0,
                            teamMembers: [],
                            isOwner: project.user_id === userId,
                            userRole: 'member'
                        };
                    }
                })
            );

            const validProjects = processedProjects.filter(project => project && project.id);

            console.log('Final processed projects with team counts:',
                validProjects.map(p => ({ name: p.name, teamCount: p.teamMembers.length }))
            );

            return validProjects;

        } catch (error) {
            console.error('Error loading projects:', error);
            return [];
        }
    };

    const calculateCompletedTasks = async (projectId) => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('status')
                .eq('project_id', projectId)
                .eq('status', 'completed');

            if (error) throw error;
            return data.length;
        } catch (error) {
            console.error('Error calculating completed tasks:', error);
            return 0;
        }
    };

    const loadTeamMembers = async (userId) => {
        try {
            // For now, let's return empty array since we need to set up teams
            // We'll implement this properly after setting up teams table
            return [
                { id: 1, name: "You", role: "Owner", status: "online" }
            ];
        } catch (error) {
            console.error('Error loading team members:', error);
            return [];
        }
    };

    const loadTasks = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Error loading tasks:', error);
            return [];
        }
    };

    const loadRecentActivity = async (userId) => {
        try {
            // We'll implement activity tracking later
            // For now, return some basic activities based on recent tasks
            const { data: recentTasks, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(3);

            if (error) throw error;

            return recentTasks.map((task, index) => ({
                id: index + 1,
                user: "You",
                action: `updated task '${task.title}'`,
                timestamp: task.updated_at,
                icon: CheckCircle
            }));

        } catch (error) {
            console.error('Error loading activity:', error);
            return [];
        }
    };

    // Enhanced progress calculation - FIXED
    const calculateProjectProgress = async (project) => {
        try {
            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('status')
                .eq('project_id', project.id); // Use project.id

            if (error) throw error;

            const total = tasks.length;
            const completed = tasks.filter(t => t.status === 'completed').length;
            return total > 0 ? Math.round((completed / total) * 100) : 0;
        } catch (error) {
            console.error('Error calculating project progress:', error);
            return 0;
        }
    };

    const calculateStats = (projects, tasks, teamMembers) => {
        const now = new Date();
        const overdueTasks = tasks.filter(task =>
            task.due_date && new Date(task.due_date) < now && task.status !== 'completed'
        ).length;

        return {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'in-progress').length,
            completedProjects: projects.filter(p => p.status === 'completed').length,
            teamMembers: teamMembers.length,
            pendingTasks: tasks.filter(t => t.status !== 'completed').length,
            overdueTasks: overdueTasks
        };
    };

    const handleProjectCreated = (newProject) => {
        setWorkspaceData(prev => ({
            ...prev,
            projects: [{
                id: newProject.id,
                name: newProject.name,
                description: newProject.description,
                progress: newProject.progress,
                status: newProject.status,
                deadline: newProject.deadline,
                totalTasks: 0,
                completedTasks: 0
            }, ...prev.projects],
            stats: {
                ...prev.stats,
                totalProjects: prev.stats.totalProjects + 1,
                activeProjects: newProject.status === 'in-progress' ?
                    prev.stats.activeProjects + 1 : prev.stats.activeProjects
            }
        }));
    };

    const handleEditProject = (project) => {
        setEditingProject(project);
        setIsEditModalOpen(true);
    };

    const handleProjectUpdated = (updatedProject) => {
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
    }

    const handleDeleteProject = async (projectId) => {
        if (window.confirm('Are you sure you want to delete this project? This will also delete all tasks and files attached to it.')) {
            try {
                // STEP 1: Get all files attached to this project
                const { data: files, error: filesError } = await supabase
                    .from('project_attachments')
                    .select('*')
                    .eq('project_id', projectId);

                if (filesError) {
                    console.error('Error fetching project files:', filesError);
                    throw new Error('Failed to load project files for deletion');
                }

                // STEP 2: Delete all files from storage
                if (files && files.length > 0) {
                    const filePaths = files.map(file => file.file_path);
                    const { error: storageError } = await supabase.storage
                        .from('project-files')
                        .remove(filePaths);

                    if (storageError) {
                        console.warn('Error deleting files from storage:', storageError);
                        // Continue with deletion - storage cleanup is secondary
                    }

                    // Delete all file records from database
                    const { error: filesDeleteError } = await supabase
                        .from('project_attachments')
                        .delete()
                        .eq('project_id', projectId);

                    if (filesDeleteError) {
                        console.error('Error deleting file records:', filesDeleteError);
                        throw new Error('Failed to delete file records');
                    }
                }

                // STEP 3: Delete all tasks associated with this project
                const { error: tasksDeleteError } = await supabase
                    .from('tasks')
                    .delete()
                    .eq('project_id', projectId);

                if (tasksDeleteError) {
                    console.error('Error deleting project tasks:', tasksDeleteError);
                    throw new Error('Failed to delete project tasks');
                }

                // STEP 4: Delete all project members
                const { error: membersDeleteError } = await supabase
                    .from('project_members')
                    .delete()
                    .eq('project_id', projectId);

                if (membersDeleteError) {
                    console.error('Error deleting project members:', membersDeleteError);
                    throw new Error('Failed to delete project members');
                }

                // STEP 5: Finally delete the project itself
                const { error } = await supabase
                    .from('projects')
                    .delete()
                    .eq('id', projectId);

                if (error) {
                    console.error('Error deleting project:', error);
                    throw new Error('Failed to delete project');
                }

                // Refresh the data to reflect the deletion
                loadWorkspaceData();

                alert('Project and all associated data deleted successfully');

            } catch (error) {
                console.error('Error deleting project:', error);
                alert('Failed to delete project: ' + error.message);
            }
        }
    };

    const handleCreateTask = async (taskData) => {
        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error('No user logged in');

            // Transform to backend format
            const backendTask = {
                title: taskData.title,
                description: taskData.description || "",
                status: statusMap[taskData.status] || "pending",
                priority: taskData.priority || "medium",
                due_date: taskData.dueDate || null,
                start_time: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
                end_time: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
                all_day: taskData.allDay || false,
                user_id: user.id,
                created_by: user.id,
                project_id: taskData.projectId || null,
                assigned_to: taskData.assignedTo || null
            };

            // Insert into Supabase
            const { data, error } = await supabase
                .from('tasks')
                .insert([backendTask])
                .select()
                .single();

            if (error) throw error;

            setIsTaskModalOpen(false);
            loadWorkspaceData(); // Refresh data

        } catch (error) {
            console.error("Failed to create task:", error);
            alert('Failed to create task: ' + error.message);
        }
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Workspace Dashboard</h1>
                <p className="text-gray-600 mt-2">Welcome to your team collaboration hub</p>
            </div>

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
                    onTaskCreated={loadWorkspaceData}
                />

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Team Section */}
                    <TeamSection teamMembers={workspaceData.teamMembers} />

                    <QuickActions
                        onCreateProject={() => setIsProjectModalOpen(true)}
                        onInviteTeamMember={handleInviteTeamMember}
                        onCreateTask={handleOpenTaskModal}
                    />

                    {/* Recent Activity */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
                        <div className="space-y-2">
                            {workspaceData.recentActivity.map(activity => (
                                <ActivityItem key={activity.id} activity={activity} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
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
            />

            <ProjectModal
                open={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
                onProjectCreated={handleProjectCreated}
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