// src/components/tasks/TaskForm.jsx - Enhanced with better UX and date handling
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, User, Flag, Folder, Clock, FileText, Target, CheckCircle } from 'lucide-react';

const TaskForm = ({ 
  onSubmit, 
  onCancel, 
  initialData, 
  isEditing = false,
  preselectedProjectId = null,
  allowProjectSelection = true,
  projectContext = null
}) => {
  // Helper function to format date for datetime-local input
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      // Format to YYYY-MM-DDTHH:MM format required by datetime-local
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.warn('Error formatting date:', error);
      return '';
    }
  };

  // Helper function to map backend status to frontend status
  const mapStatusForForm = (status) => {
    if (!status) return 'todo';
    
    const statusMap = {
      'pending': 'todo',
      'in-progress': 'progress',
      'completed': 'complete',
      'todo': 'todo',
      'progress': 'progress',
      'complete': 'complete'
    };
    
    return statusMap[status] || 'todo';
  };

  // Initialize form data with proper field mapping
  const initializeFormData = () => {
    if (!initialData) {
      return {
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: '',
        allDay: false,
        projectId: preselectedProjectId || '',
        assignedTo: ''
      };
    }

    return {
      title: initialData.title || '',
      description: initialData.description || '',
      status: mapStatusForForm(initialData.displayStatus || initialData.status),
      priority: initialData.priority || 'medium',
      dueDate: formatDateForInput(initialData.dueDate || initialData.due_date),
      allDay: initialData.allDay || initialData.all_day || false,
      projectId: preselectedProjectId || initialData.project_id || '',
      assignedTo: initialData.assigned_to || ''
    };
  };

  const [formData, setFormData] = useState(initializeFormData());
  const [errors, setErrors] = useState({});
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug logging to help troubleshoot
  useEffect(() => {
    if (initialData && isEditing) {
      console.log('TaskForm initialData:', initialData);
      console.log('TaskForm formData after initialization:', formData);
    }
  }, [initialData, isEditing, formData]);

  // Re-initialize form data when initialData changes
  useEffect(() => {
    const newFormData = initializeFormData();
    setFormData(newFormData);
    setErrors({}); // Clear any existing errors
  }, [initialData, preselectedProjectId]);

  useEffect(() => {
    if (allowProjectSelection) {
      loadAvailableProjects();
    }
  }, [allowProjectSelection]);

  useEffect(() => {
    const projectId = formData.projectId || preselectedProjectId;
    if (projectId) {
      loadProjectMembers(projectId);
    } else {
      setAvailableMembers([]);
      setFormData(prev => ({ ...prev, assignedTo: '' }));
    }
  }, [formData.projectId, preselectedProjectId]);

  const loadAvailableProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const { data: membershipData } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      if (membershipData && membershipData.length > 0) {
        const projectIds = membershipData.map(m => m.project_id);
        
        const { data: projects, error } = await supabase
          .from('projects')
          .select('id, name, description')
          .in('id', projectIds)
          .order('name');

        if (error) throw error;
        setAvailableProjects(projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProjectMembers = async (projectId) => {
    if (!projectId) return;
    
    setLoadingMembers(true);
    try {
      const { data: members, error } = await supabase
        .rpc('get_project_team_members', { project_ids: [projectId] });

      if (error) {
        const { data: fallbackMembers, error: fallbackError } = await supabase
          .from('project_members')
          .select(`
            user_id,
            role,
            user:profiles(id, name, email, avatar_url)
          `)
          .eq('project_id', projectId);

        if (fallbackError) throw fallbackError;

        const formattedMembers = fallbackMembers?.map(m => ({
          user_id: m.user_id,
          user_name: m.user?.name || m.user?.email || 'Unknown User',
          user_email: m.user?.email || '',
          user_avatar_url: m.user?.avatar_url || null,
          role: m.role
        })) || [];

        setAvailableMembers(formattedMembers);
      } else {
        setAvailableMembers(members || []);
      }
    } catch (error) {
      console.error('Error loading project members:', error);
      setAvailableMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }
    
    if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Validate date format if provided
    if (formData.dueDate) {
      const date = new Date(formData.dueDate);
      if (isNaN(date.getTime())) {
        newErrors.dueDate = 'Please enter a valid date and time';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      console.log('Form validation failed:', errors);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const submissionData = {
        ...formData,
        dueDate: formData.dueDate || null,
        projectId: formData.projectId || preselectedProjectId || null,
        assignedTo: formData.assignedTo || null
      };

      console.log('Submitting task data:', submissionData);
      await onSubmit(submissionData);
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrors({ submit: 'An error occurred while saving the task. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-green-600 bg-green-50 border-green-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      high: 'text-red-600 bg-red-50 border-red-200'
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: 'text-slate-600 bg-slate-50 border-slate-200',
      progress: 'text-blue-600 bg-blue-50 border-blue-200',
      complete: 'text-green-600 bg-green-50 border-green-200'
    };
    return colors[status] || colors.todo;
  };

  const characterCount = {
    title: formData.title.length,
    description: formData.description.length
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Context Display (when project is preselected) */}
        {!allowProjectSelection && projectContext && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Folder className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Adding task to project</p>
                <p className="text-sm text-blue-700">{projectContext.name}</p>
              </div>
              <div className="ml-auto">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
        )}

        {/* Editing Context Display */}
        {isEditing && initialData && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Target className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">Editing task</p>
                <p className="text-sm text-amber-700">Make your changes below</p>
              </div>
            </div>
          </div>
        )}

        {/* Global Form Error */}
        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-800">{errors.submit}</p>
          </div>
        )}

        {/* Title Field */}
        <div className="space-y-2">
          <label htmlFor="title" className="flex items-center text-sm font-semibold text-slate-900">
            <Target className="w-4 h-4 mr-2 text-slate-500" />
            Task Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="What needs to be done?"
            className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg placeholder-slate-400 ${
              errors.title ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
            }`}
            disabled={isSubmitting}
            autoComplete="off"
          />
          <div className="flex justify-between items-center text-xs">
            {errors.title ? (
              <span className="text-red-600 font-medium">{errors.title}</span>
            ) : (
              <span className="text-slate-500">Give your task a clear, descriptive title</span>
            )}
            <span className={`${characterCount.title > 80 ? 'text-red-500' : 'text-slate-400'}`}>
              {characterCount.title}/100
            </span>
          </div>
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <label htmlFor="description" className="flex items-center text-sm font-semibold text-slate-900">
            <FileText className="w-4 h-4 mr-2 text-slate-500" />
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Add more details about this task..."
            rows={4}
            className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none placeholder-slate-400 ${
              errors.description ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
            }`}
            disabled={isSubmitting}
          />
          <div className="flex justify-between items-center text-xs">
            {errors.description ? (
              <span className="text-red-600 font-medium">{errors.description}</span>
            ) : (
              <span className="text-slate-500">Optional: Provide additional context</span>
            )}
            <span className={`${characterCount.description > 400 ? 'text-red-500' : 'text-slate-400'}`}>
              {characterCount.description}/500
            </span>
          </div>
        </div>

        {/* Two Column Layout for Status and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status */}
          <div className="space-y-2">
            <label htmlFor="status" className="flex items-center text-sm font-semibold text-slate-900">
              <Flag className="w-4 h-4 mr-2 text-slate-500" />
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${getStatusColor(formData.status)}`}
              disabled={isSubmitting}
            >
              <option value="todo">To Do</option>
              <option value="progress">In Progress</option>
              <option value="complete">Completed</option>
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label htmlFor="priority" className="flex items-center text-sm font-semibold text-slate-900">
              <Flag className="w-4 h-4 mr-2 text-slate-500" />
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${getPriorityColor(formData.priority)}`}
              disabled={isSubmitting}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Project Assignment (only show when allowed) */}
        {allowProjectSelection && (
          <div className="space-y-2">
            <label htmlFor="projectId" className="flex items-center text-sm font-semibold text-slate-900">
              <Folder className="w-4 h-4 mr-2 text-slate-500" />
              Project
            </label>
            <select
              id="projectId"
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              disabled={loadingProjects || !!preselectedProjectId || isSubmitting}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Personal Task (No Project)</option>
              {availableProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {loadingProjects && (
              <p className="text-sm text-slate-500 animate-pulse">Loading projects...</p>
            )}
            {preselectedProjectId && (
              <p className="text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                Project is pre-selected and cannot be changed
              </p>
            )}
          </div>
        )}

        {/* Member Assignment */}
        {(formData.projectId || preselectedProjectId) && (
          <div className="space-y-2">
            <label htmlFor="assignedTo" className="flex items-center text-sm font-semibold text-slate-900">
              <User className="w-4 h-4 mr-2 text-slate-500" />
              Assign To
            </label>
            <select
              id="assignedTo"
              name="assignedTo"
              value={formData.assignedTo}
              onChange={handleChange}
              disabled={loadingMembers || isSubmitting}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-slate-100"
            >
              <option value="">Unassigned</option>
              {availableMembers.map(member => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user_name} {member.role && `(${member.role})`}
                </option>
              ))}
            </select>
            {loadingMembers && (
              <p className="text-sm text-slate-500 animate-pulse">Loading team members...</p>
            )}
            {availableMembers.length === 0 && !loadingMembers && (formData.projectId || preselectedProjectId) && (
              <p className="text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                No team members found for this project
              </p>
            )}
          </div>
        )}

        {/* Due Date and All Day */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="dueDate" className="flex items-center text-sm font-semibold text-slate-900">
              <Calendar className="w-4 h-4 mr-2 text-slate-500" />
              Due Date
            </label>
            <input
              type="datetime-local"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              className={`w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.dueDate ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
              }`}
              disabled={isSubmitting}
            />
            {errors.dueDate && (
              <span className="text-sm text-red-600 font-medium">{errors.dueDate}</span>
            )}
            <p className="text-xs text-slate-500">Optional: Set a deadline for this task</p>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl">
            <input
              type="checkbox"
              id="allDay"
              name="allDay"
              checked={formData.allDay}
              onChange={handleChange}
              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
              disabled={isSubmitting}
            />
            <label htmlFor="allDay" className="flex items-center text-sm font-medium text-slate-700">
              <Clock className="w-4 h-4 mr-2 text-slate-500" />
              All day task
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            disabled={!formData.title.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isEditing ? 'Updating...' : 'Creating...'}
              </span>
            ) : (
              <>{isEditing ? 'Update Task' : 'Create Task'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;