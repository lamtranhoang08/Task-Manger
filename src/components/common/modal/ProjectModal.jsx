// src/components/common/modal/ProjectModal.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ProjectModal({ open, onClose, onProjectCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planned',
    deadline: '',
    teamMembers: []
  });
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);

  useEffect(() => {
    if (open && searchTerm.length > 2) { // Only search when term has at least 3 characters
      loadAvailableUsers();
    } else {
      setAvailableUsers([]);
    }
  }, [open, searchTerm]);

  const loadAvailableUsers = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let query = supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .neq('id', currentUser.id) // Exclude current user
        .limit(5); // Limit to 5 results for better performance

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // In your ProjectModal.jsx or wherever you create projects
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Step 1: Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([{
          name: formData.name,
          description: formData.description,
          status: formData.status,
          deadline: formData.deadline || null,
          user_id: user.id
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      // Step 2: CRITICAL - Add the creator as owner in project_members table
      const { error: ownerMembershipError } = await supabase
        .from('project_members')
        .insert([{
          project_id: project.id,
          user_id: user.id,
          role: 'owner'
        }]);

      if (ownerMembershipError) throw ownerMembershipError;

      // Step 3: Add selected team members as collaborators
      if (formData.teamMembers.length > 0) {
        const membersToAdd = formData.teamMembers.map(memberId => ({
          project_id: project.id,
          user_id: memberId,
          role: 'collaborator'
        }));

        const { error: membersError } = await supabase
          .from('project_members')
          .insert(membersToAdd);

        if (membersError) throw membersError;
      }

      onProjectCreated(project);
      onClose();
      setFormData({ name: '', description: '', status: 'planned', deadline: '', teamMembers: [] });
      setSearchTerm('');
      setShowUserSearch(false);

    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamMemberToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(userId)
        ? prev.teamMembers.filter(id => id !== userId)
        : [...prev.teamMembers, userId]
    }));
  }

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowUserSearch(value.length > 0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Create New Project</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Team Members Selection - Only show when user wants to add members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Add Team Members (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowUserSearch(!showUserSearch)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showUserSearch ? 'Cancel' : '+ Add Members'}
              </button>
            </div>

            {showUserSearch && (
              <>
                <input
                  type='text'
                  placeholder="Search users by name..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />

                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {availableUsers.map(user => (
                    <label key={user.id} className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.teamMembers.includes(user.id)}
                        onChange={() => handleTeamMemberToggle(user.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex items-center space-x-2">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold">
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <span className="text-sm text-gray-700">{user.name || user.email}</span>
                      </div>
                    </label>
                  ))}

                  {searchTerm.length > 0 && availableUsers.length === 0 && (
                    <div className='p-3 text-sm text-gray-500'>
                      {searchTerm.length < 3 ? 'Type at least 3 characters to search' : 'No users found'}
                    </div>
                  )}

                  {searchTerm.length === 0 && (
                    <div className='p-3 text-sm text-gray-500'>
                      Type a name to search for users
                    </div>
                  )}
                </div>

                {formData.teamMembers.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Selected: {formData.teamMembers.length} member(s)</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}