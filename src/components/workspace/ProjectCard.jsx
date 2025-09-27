import React, { useState, useEffect } from 'react';
import { FileUploadButton, FileItem } from '../files';
import { supabase } from '../../lib/supabase';
import { Paperclip, Users, MoreVertical, Edit, Trash2, Plus } from 'lucide-react';
import FilePreviewModal from '../files/FilePreviewModal';
import ProjectTaskButton from './ProjectTaskButton';
import TaskModal from '../common/modal/TaskModal';

const ProjectCard = ({ project, onEdit, onDelete, onTaskCreated }) => {
    const [projectFiles, setProjectFiles] = useState([]);
    const [showFiles, setShowFiles] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [showTeam, setShowTeam] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    // Use team members from props - this ensures consistency across all users
    const teamMembers = project.teamMembers || [];

    // Load files for this project when component mounts
    useEffect(() => {
        loadProjectFiles();
    }, [project.id]);

    // Refresh files when the section is opened and no files are loaded
    useEffect(() => {
        if (showFiles && projectFiles.length === 0) {
            loadProjectFiles();
        }
    }, [showFiles]);

    // Close dropdown menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showMenu && !event.target.closest('.menu-container')) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const loadProjectFiles = async () => {
        try {
            console.log('Loading files for project:', project.id);

            const { data, error } = await supabase
                .from('project_attachments')
                .select('*')
                .eq('project_id', project.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading files:', error);
                throw error;
            }

            console.log('Loaded files:', data);
            setProjectFiles(data || []);

        } catch (error) {
            console.error('Error loading project files:', error);
            setProjectFiles([]); // Set empty array on error
        }
    };

    const handleFileUploaded = (newFile) => {
        setProjectFiles(prev => {
            // Check if file already exists to avoid duplicates
            const exists = prev.some(file => file.id === newFile.id);
            return exists ? prev : [newFile, ...prev];
        });
    };

    const handleFileDeleted = async (fileId) => {
        try {
            // Find the file to get its path
            const fileToDelete = projectFiles.find(f => f.id === fileId);
            if (!fileToDelete) return;

            // Delete from database
            const { error: dbError } = await supabase
                .from('project_attachments')
                .delete()
                .eq('id', fileId);

            if (dbError) throw dbError;

            // Delete from storage
            const { error: storageError } = await supabase.storage
                .from('project-files')
                .remove([fileToDelete.file_path]);

            if (storageError) {
                console.error('Storage deletion error:', storageError);
                // Continue even if storage deletion fails - we've removed from DB
            }

            // Update UI by removing the file from state
            setProjectFiles(prev => prev.filter(file => file.id !== fileId));

        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete file: ' + error.message);
        }
    };

    const handleFileDownload = async (file) => {
        try {
            const { data, error } = await supabase.storage
                .from('project-files')
                .download(file.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.filename;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file: ' + error.message);
        }
    };

    const handleFilePreview = (file) => {
        setPreviewFile(file);
    };

    const handleMenuAction = (action) => {
        setShowMenu(false);
        if (action === 'edit') {
            onEdit(project);
        } else if (action === 'delete') {
            if (window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
                onDelete(project.id);
            }
        }
    };

    // Format deadline display
    const formatDeadline = (deadline) => {
        if (!deadline) return 'No deadline';

        const deadlineDate = new Date(deadline);
        const now = new Date();
        const isOverdue = deadlineDate < now && project.status !== 'completed';

        return (
            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                Due: {deadlineDate.toLocaleDateString()}
                {isOverdue && ' (Overdue)'}
            </span>
        );
    };

    // Get progress bar color based on progress and status
    const getProgressBarColor = () => {
        if (project.status === 'completed') return 'bg-green-500';
        if (project.progress < 30) return 'bg-red-500';
        if (project.progress < 70) return 'bg-yellow-500';
        return 'bg-blue-500';
    };

    // Status mapping to match database constraints
    const statusMap = {
        "todo": "pending",
        "progress": "in-progress",
        "complete": "completed"
    };

    const handleAddTask = async (taskData) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Transform task data to match database format
            const backendTask = {
                title: taskData.title,
                description: taskData.description || '',
                status: statusMap[taskData.status] || 'pending',
                priority: taskData.priority || 'medium',
                due_date: taskData.dueDate || null,
                start_time: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
                end_time: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
                all_day: taskData.allDay || false,
                project_id: project.id,
                user_id: user.id,
                created_by: user.id,
                assigned_to: taskData.assignedTo || null,
            };

            const { error } = await supabase
                .from('tasks')
                .insert([backendTask]);

            if (error) throw error;

            setIsTaskModalOpen(false);

            // Call the callback to refresh parent data
            if (typeof onTaskCreated === 'function') {
                onTaskCreated();
            }

        } catch (error) {
            console.error('Error creating task:', error);
            alert('Failed to create task: ' + error.message);
        }
    };

    return (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            {/* Header with project info and actions */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-lg truncate" title={project.name}>
                        {project.name}
                    </h3>
                    <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${project.status === 'completed' ? 'bg-green-100 text-green-800' :
                        project.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                            project.status === 'planned' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                        }`}>
                        {project.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    {project.userRole && (
                        <span className="ml-2 inline-block px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                            {project.userRole.charAt(0).toUpperCase() + project.userRole.slice(1)}
                        </span>
                    )}
                </div>

                {/* Action buttons */}
                <div className="relative menu-container">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
                        aria-label="Project options"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-32">
                            <button
                                onClick={() => handleMenuAction('edit')}
                                className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={() => handleMenuAction('delete')}
                                className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {project.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2" title={project.description}>
                    {project.description}
                </p>
            )}

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Progress</span>
                    <span>{project.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
                        style={{ width: `${project.progress || 0}%` }}
                    />
                </div>
            </div>

            {/* Team Members Section */}
            <div className="mb-4 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => setShowTeam(!showTeam)}
                        className="flex items-center space-x-2 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                        aria-label={`${showTeam ? 'Hide' : 'Show'} team members`}
                    >
                        <Users className="w-4 h-4" />
                        <span>Team ({teamMembers.length})</span>
                    </button>
                </div>

                {showTeam && (
                    <div className="space-y-2 mt-2">
                        {teamMembers.map((member) => (
                            <div key={member.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                                {member.avatar_url ? (
                                    <img
                                        src={member.avatar_url}
                                        alt={member.name || 'Team member'}
                                        className="w-6 h-6 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs font-medium">
                                            {(member.name || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate">
                                        {member.name || 'Unknown User'}
                                    </p>
                                    <p className="text-xs text-gray-500 capitalize">
                                        {member.role || 'member'}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {teamMembers.length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-2">
                                No team members yet
                            </p>
                        )}
                    </div>
                )}

                {/* Always show avatar stack when collapsed */}
                {!showTeam && teamMembers.length > 0 && (
                    <div className="flex -space-x-2">
                        {teamMembers.slice(0, 5).map((member) => (
                            <div key={member.id} className="relative group">
                                {member.avatar_url ? (
                                    <img
                                        src={member.avatar_url}
                                        alt={member.name || 'Team member'}
                                        className="w-6 h-6 rounded-full border-2 border-white object-cover"
                                    />
                                ) : (
                                    <div className="w-6 h-6 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center text-xs font-medium text-white">
                                        {(member.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20">
                                    {member.name || 'Unknown'} ({member.role || 'member'})
                                </div>
                            </div>
                        ))}
                        {teamMembers.length > 5 && (
                            <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                +{teamMembers.length - 5}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Files Section */}
            <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => setShowFiles(!showFiles)}
                        className="flex items-center space-x-2 text-xs text-gray-600 hover:text-gray-800 transition-colors"
                        aria-label={`${showFiles ? 'Hide' : 'Show'} project files`}
                    >
                        <Paperclip className="w-4 h-4" />
                        <span>Files ({projectFiles.length})</span>
                    </button>

                    {showFiles && (
                        <FileUploadButton
                            projectId={project.id}
                            onFileUploaded={handleFileUploaded}
                        />
                    )}
                </div>

                {showFiles && (
                    <div className="space-y-2 mt-2">
                        {projectFiles.map((file) => (
                            <FileItem
                                key={file.id}
                                file={file}
                                onDelete={handleFileDeleted}
                                onDownload={handleFileDownload}
                                onPreview={handleFilePreview}
                                showActions={true}
                            />
                        ))}

                        {projectFiles.length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-2">
                                No files attached yet
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer with deadline + tasks + add task */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-3 mt-3 border-t border-gray-100">
                <div>
                    {formatDeadline(project.deadline)} · {project.completedTasks || 0}/{project.totalTasks || 0} tasks
                </div>
                <button
                    onClick={() => setIsTaskModalOpen(true)}
                    className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    New Task
                </button>
            </div>

            {/* Enhanced Task modal with project context */}
            <TaskModal
                open={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                onSubmit={handleAddTask}
                initialData={{ projectId: project.id }}
                isEditing={false}
                projectContext={{
                    id: project.id,
                    name: project.name
                }}
            />

            {/* Preview Modal */}
            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    isOpen={!!previewFile}
                    onClose={() => setPreviewFile(null)}
                    onDownload={handleFileDownload}
                />
            )}
        </div>
    );
};

export default ProjectCard;