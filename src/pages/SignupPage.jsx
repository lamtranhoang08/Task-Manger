"use client";

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
        throw new Error('Please fill in all fields.');
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password.trim(),
        options: {
          data: {
            name: formData.name.trim()
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('User already exists with this email.');
        }
        throw authError;
      }

      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              name: formData.name.trim(),
              email: formData.email.trim(),
              created_at: new Date().toISOString(),
            }
          ]);

        if (profileError) {
          console.warn('Profile creation failed (table might not exist yet):', profileError.message);
        }
      } catch (profileErr) {
        console.warn('Profile creation error:', profileErr.message);
      }
      
      setSuccess('Account created successfully! Please check your email for verification before logging in.');
      setTimeout(() => navigate('/login'), 5000); // Redirect after 5 seconds
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100">
      <div className="max-w-md w-full p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl transition-all">
        <div className="text-center">
          <CheckCircleIcon className="mx-auto h-16 w-16 text-blue-500 mb-4" />
          <h2 className="text-3xl font-extrabold text-white">Join Taskify</h2>
          <p className="mt-2 text-sm text-gray-400">
            Create your account to start managing your tasks.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div
              className="bg-red-900 text-red-300 border border-red-700 p-4 rounded-md text-sm"
              role="alert"
            >
              <p className="font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div
              className="bg-green-900 text-green-300 border border-green-700 p-4 rounded-md text-sm"
              role="alert"
            >
              <p className="font-medium">{success}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="sr-only">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="input-field-dark transition-all"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input-field-dark transition-all"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="input-field-dark transition-all"
              placeholder="Create a password (min. 6 characters)"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="sr-only">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="input-field-dark transition-all"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <div className="text-center text-sm mt-6">
            <p className="text-gray-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
