// src/components/common/modal/EditProjectModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { X, Plus, Trash2, Search } from 'lucide-react';

export default function EditProjectModal({ open, onClose, project, onProjectUpdated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planned',
    deadline: ''
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'members'
  
  // Member management states
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState('collaborator');

  // Pre-fill form when project data changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'planned',
        deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ''
      });
      loadTeamMembers();
    }
  }, [project]);

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
  }, [searchEmail]);

  const loadTeamMembers = async () => {
    if (!project?.id) return;
    
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          id,
          role,
          user_id,
          user:profiles(id, name, email, avatar_url)
        `)
        .eq('project_id', project.id)
        .order('role', { ascending: false }); // Owners first

      if (error) throw error;

      const members = data?.map(item => ({
        id: item.id,
        user_id: item.user_id,
        name: item.user?.name || 'Unknown User',
        email: item.user?.email || '',
        avatar_url: item.user?.avatar_url || null,
        role: item.role
      })) || [];

      setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const searchUsers = async () => {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .ilike('email', `%${searchEmail}%`)
        .limit(5);

      if (error) throw error;

      // Filter out users already in the project
      const existingUserIds = teamMembers.map(m => m.user_id);
      const filtered = data?.filter(user => !existingUserIds.includes(user.id)) || [];
      
      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const addMember = async (user) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .insert([{
          project_id: project.id,
          user_id: user.id,
          role: newMemberRole
        }]);

      if (error) throw error;

      // Add to local state
      setTeamMembers(prev => [...prev, {
        id: Date.now(), // Temporary ID
        user_id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        role: newMemberRole
      }]);

      // Clear search
      setSearchEmail('');
      setSearchResults([]);
      setNewMemberRole('collaborator');

      // Trigger refresh in parent component
      onProjectUpdated && onProjectUpdated(project);

    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member: ' + error.message);
    }
  };

  const removeMember = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from this project?`)) return;

    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));

      // Trigger refresh in parent component
      onProjectUpdated && onProjectUpdated(project);

    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member: ' + error.message);
    }
  };

  const updateMemberRole = async (memberId, newRole) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      // Update local state
      setTeamMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));

      // Trigger refresh in parent component
      onProjectUpdated && onProjectUpdated(project);

    } catch (error) {
      console.error('Error updating member role:', error);
      alert('Failed to update member role: ' + error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update project details
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: formData.name,
          description: formData.description,
          status: formData.status,
          deadline: formData.deadline || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)
        .select()
        .single();

      if (error) throw error;
      
      onProjectUpdated(data);
      onClose();

    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-800">Edit Project</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Project Details
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Team Members ({teamMembers.length})
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Project description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="planned">Planned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline
                  </label>
                  <input
                    type="date"
                    name="deadline"
                    value={formData.deadline}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Project'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* Add Member Section */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Add Team Member</h3>
                
                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      placeholder="Search by email..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="collaborator">Collaborator</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg bg-white max-h-48 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                        <div className="flex items-center space-x-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium">
                                {user.name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">{user.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => addMember(user)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchLoading && (
                  <div className="text-center py-2 text-sm text-gray-500">Searching...</div>
                )}

                {searchEmail.length > 2 && !searchLoading && searchResults.length === 0 && (
                  <div className="text-center py-2 text-sm text-gray-500">No users found</div>
                )}
              </div>

              {/* Current Members */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Current Members</h3>
                
                {loadingMembers ? (
                  <div className="text-center py-4 text-sm text-gray-500">Loading members...</div>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium">
                                {member.name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberRole(member.id, e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="collaborator">Collaborator</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                          
                          <button
                            onClick={() => removeMember(member.id, member.name)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {teamMembers.length === 0 && (
                      <div className="text-center py-4 text-sm text-gray-500">No team members yet</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}