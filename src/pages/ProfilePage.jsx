// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ProfilePage({ currentUser, onProfileUpdate }) {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || currentUser?.avatar || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadProfileData();
    }
  }, [currentUser]);

  const loadProfileData = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, email, avatar_url')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.warn('Error loading profile:', error);
        setName(currentUser.name || '');
        setEmail(currentUser.email || '');
        setAvatarUrl(currentUser.avatar_url || currentUser.avatar || '');
      } else if (profile) {
        setName(profile.name || '');
        setEmail(profile.email || '');
        setAvatarUrl(profile.avatar_url || '');
      }
    } catch (err) {
      console.warn('Failed to load profile:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
  
    try {
      // First update basic profile info (name, email)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          email: email.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);
  
      if (profileError) throw profileError;
  
      let finalAvatarUrl = avatarUrl;
      
      // Then upload avatar if selected (separate operation)
      if (avatarFile) {
        finalAvatarUrl = await handleAvatarUpload();
      }
  
      setMessage('Profile updated successfully!');
  
      // Refresh user data - pass the updated values
      if (typeof onProfileUpdate === 'function') {
        onProfileUpdate({
          name: name.trim(),
          avatar: finalAvatarUrl,
          email: email.trim(),
        });
      } else {
        await loadProfileData();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async () => {
    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
  
      // Optional: Delete old avatar if exists
      if (currentUser.avatar_url) {
        const oldFileName = currentUser.avatar_url.split('/').pop();
        await supabase.storage
          .from('avatars')
          .remove([`avatars/${oldFileName}`]);
      }
  
      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { 
          upsert: true,
          cacheControl: '3600',
        });
  
      if (uploadError) throw uploadError;
  
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
  
      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get avatar public URL');
      }
  
      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);
  
      if (updateError) throw updateError;
  
      setAvatarUrl(publicUrlData.publicUrl);
      return publicUrlData.publicUrl;
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage('Error uploading avatar: ' + error.message);
      throw error;
    }
  };

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) {
        setMessage('File size too large. Maximum size is 5MB.');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setMessage('Please select an image file.');
        return;
      }

      setAvatarFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => setAvatarUrl(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  if (!currentUser) {
    return <div>Please log in to view your profile.</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Profile Settings</h1>
      
      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.includes('Error') 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleUpdateProfile} className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex items-center space-x-6">
          <div className="shrink-0">
            <img
              className="h-16 w-16 object-cover rounded-full"
              src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`}
              alt="Current profile"
            />
          </div>
          <label className="block">
            <span className="sr-only">Choose profile photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </label>
        </div>

        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your name"
          />
        </div>

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email"
          />
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

ProfilePage.defaultProps = {
  onProfileUpdate: null
};