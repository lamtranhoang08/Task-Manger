// src/components/common/TeamMemberManager.jsx - UPDATED
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export const TeamMemberManager = ({ projectId, onMembersUpdated }) => {
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [currentTeamMembers, setCurrentTeamMembers] = useState([]);
  const [newTeamMembers, setNewTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadTeamMembers();
    }
  }, [projectId]);

  useEffect(() => {
    if (searchTerm.length > 2) {
      loadAvailableUsers();
    } else {
      setAvailableUsers([]);
    }
  }, [searchTerm, currentTeamMembers]);

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          role,
          user:profiles(id, name, email, avatar_url)
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      
      const members = data.map(item => ({
        id: item.user.id,
        name: item.user.name,
        email: item.user.email,
        avatar_url: item.user.avatar_url,
        role: item.role
      }));
      
      setCurrentTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let query = supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .neq('id', currentUser.id)
        .limit(5);

      // Exclude users already in the project
      const currentMemberIds = currentTeamMembers.map(member => member.id);
      if (currentMemberIds.length > 0) {
        query = query.not('id', 'in', `(${currentMemberIds.join(',')})`);
      }

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

  const handleTeamMemberToggle = (userId) => {
    setNewTeamMembers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowUserSearch(value.length > 0);
  };

  const addTeamMembers = async () => {
    if (newTeamMembers.length === 0) return;
    
    setLoading(true);
    try {
      const membersToAdd = newTeamMembers.map(userId => ({
        project_id: projectId,
        user_id: userId,
        role: 'collaborator'
      }));
      
      const { error } = await supabase
        .from('project_members')
        .insert(membersToAdd);
      
      if (error) throw error;
      
      // Refresh team members
      await loadTeamMembers();
      setNewTeamMembers([]);
      setSearchTerm('');
      setShowUserSearch(false);
      
      if (onMembersUpdated) onMembersUpdated();
      
    } catch (error) {
      console.error('Error adding team members:', error);
      alert('Failed to add team members: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeTeamMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Update local state
      setCurrentTeamMembers(prev => prev.filter(member => member.id !== userId));
      if (onMembersUpdated) onMembersUpdated();
      
    } catch (error) {
      console.error('Error removing team member:', error);
      alert('Failed to remove team member: ' + error.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Team Members */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current Team Members
        </label>
        <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
          {currentTeamMembers.map(member => (
            <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center space-x-2">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-xs">
                    {member.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeTeamMember(member.id)}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                Remove
              </button>
            </div>
          ))}
          
          {currentTeamMembers.length === 0 && (
            <div className='p-3 text-sm text-gray-500 text-center'>
              No team members yet
            </div>
          )}
        </div>
      </div>

      {/* Add Team Members Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Add Team Members
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
                    checked={newTeamMembers.includes(user.id)}
                    onChange={() => handleTeamMemberToggle(user.id)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <div className="flex items-center space-x-2">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-xs">
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
            
            {newTeamMembers.length > 0 && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">Selected: {newTeamMembers.length} new member(s)</p>
                <button
                  type="button"
                  onClick={addTeamMembers}
                  disabled={loading}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Selected'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};