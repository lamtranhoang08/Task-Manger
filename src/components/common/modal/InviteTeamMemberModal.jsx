// src/components/common/modal/InviteTeamMemberModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Plus, Search, Users, CheckCircle, AlertCircle } from 'lucide-react';

const InviteTeamMemberModal = ({ isOpen, onClose, projectId, onMemberAdded, projects = [] }) => {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState('collaborator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingMembers, setExistingMembers] = useState([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId(projectId);
      setSearchEmail('');
      setSearchResults([]);
      setError('');
      setSuccess('');
      setNewMemberRole('collaborator');
      if (projectId) {
        loadExistingMembers(projectId);
      }
    }
  }, [isOpen, projectId]);

  // Load existing members when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadExistingMembers(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Search for users when email input changes
  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (searchEmail.length > 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchEmail, selectedProjectId]);

  const loadExistingMembers = async (projectIdToLoad) => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectIdToLoad);

      if (error) throw error;
      setExistingMembers(data?.map(m => m.user_id) || []);
    } catch (error) {
      console.error('Error loading existing members:', error);
    }
  };

  const searchUsers = async () => {
    if (!selectedProjectId) return;
    
    setSearchLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .ilike('email', `%${searchEmail}%`)
        .limit(10);

      if (error) throw error;

      // Filter out users already in the project
      const filtered = data?.filter(user => !existingMembers.includes(user.id)) || [];
      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search users');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const inviteMember = async (user) => {
    if (!selectedProjectId) {
      setError('Please select a project first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Double-check if user is already a member
      const { data: existingCheck, error: checkError } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', selectedProjectId)
        .eq('user_id', user.id)
        .limit(1);

      if (checkError) throw checkError;

      if (existingCheck && existingCheck.length > 0) {
        setError(`${user.name || user.email} is already a member of this project`);
        setLoading(false);
        return;
      }

      // Add user to project
      const { error: insertError } = await supabase
        .from('project_members')
        .insert([{
          project_id: selectedProjectId,
          user_id: user.id,
          role: newMemberRole
        }]);

      if (insertError) throw insertError;

      // Update existing members list
      setExistingMembers(prev => [...prev, user.id]);
      
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.id !== user.id));
      
      // Show success message
      setSuccess(`${user.name || user.email} has been added to the project`);
      
      // Call the callback
      onMemberAdded?.();

      // Auto-close success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('Invite error:', err);
      setError('Failed to invite member: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (e) => {
    const newProjectId = e.target.value;
    setSelectedProjectId(newProjectId);
    setSearchEmail('');
    setSearchResults([]);
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    setSearchEmail('');
    setSearchResults([]);
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Invite Team Member</h2>
              <p className="text-sm text-gray-600">Add collaborators to your project</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Project Selection */}
          {projects.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project
              </label>
              <select
                value={selectedProjectId || ''}
                onChange={handleProjectChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Project Info */}
          {selectedProject && (
            <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">
                  Adding to: {selectedProject.name}
                </span>
              </div>
              {selectedProject.description && (
                <p className="text-xs text-blue-700 mt-1 ml-4">
                  {selectedProject.description}
                </p>
              )}
            </div>
          )}

          {/* Search Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Find Team Member
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="Search by email address..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!selectedProjectId}
                />
              </div>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!selectedProjectId}
              >
                <option value="collaborator">Collaborator</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            
            {!selectedProjectId && (
              <p className="text-xs text-gray-500 mt-1">
                Please select a project first
              </p>
            )}
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-green-700">{success}</span>
            </div>
          )}

          {/* Search Results */}
          {searchLoading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500 mt-2">Searching users...</p>
            </div>
          )}

          {!searchLoading && searchEmail.length > 2 && searchResults.length === 0 && (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No users found with that email</p>
              <p className="text-xs text-gray-400 mt-1">
                Make sure they have registered an account
              </p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Search Results ({searchResults.length})
              </h3>
              
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all">
                  <div className="flex items-center space-x-3">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.name} 
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {(user.name || user.email)?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => inviteMember(user)}
                    disabled={loading}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Invite</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Role Information */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Role Permissions</h3>
            <div className="space-y-1 text-xs text-gray-600">
              <div><span className="font-medium">Owner:</span> Full project control including deletion</div>
              <div><span className="font-medium">Admin:</span> Manage project and team members</div>
              <div><span className="font-medium">Collaborator:</span> View and edit project content</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteTeamMemberModal;