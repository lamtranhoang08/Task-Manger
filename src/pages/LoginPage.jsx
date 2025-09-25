// src/pages/LoginPage.jsx - Enhanced with session management based on your current version
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircleIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function LoginPage({ onAuthStateChange }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle messages from navigation state (e.g., email confirmation, session expired)
  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
      setMessageType(location.state.type || 'info');
      setSessionError(location.state.sessionError || false);
      // Clear the navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          return;
        }

        if (session && session.user) {
          // Valid session exists, redirect to dashboard
          console.log('Valid session found, redirecting...');
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        console.error('Session validation error:', err);
      }
    };

    checkSession();
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    
    // Clear errors when user starts typing
    if (error) setError('');
    if (message && messageType === 'error') setMessage('');
  };

  const validateSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session validation error:', error);
        return false;
      }
      
      return !!session;
    } catch (err) {
      console.error('Session validation failed:', err);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setSessionError(false);

    try {
      if (!formData.email || !formData.password) {
        throw new Error('Please fill in all fields.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password.trim(),
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and click the confirmation link before signing in.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes and try again.');
        } else if (error.message.includes('signup is disabled')) {
          throw new Error('Account registration is currently disabled. Please contact support.');
        }
        throw error;
      }

      if (data.user && data.session) {
        // Notify parent component of successful login
        if (onAuthStateChange) {
          onAuthStateChange(data.session, data.user);
        }

        // Validate session before proceeding
        const sessionValid = await validateSession();
        if (!sessionValid) {
          throw new Error('Session validation failed. Please try again.');
        }

        // Check if user profile exists, create if it doesn't
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile && !profileError) {
            // Create profile if it doesn't exist
            const { error: insertError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: data.user.id,
                  name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
                  email: data.user.email,
                  created_at: new Date().toISOString(),
                }
              ]);

            if (insertError) {
              console.error('Profile creation error:', insertError);
              // Don't throw here as login was successful
            }
          }
        } catch (profileErr) {
          console.error('Profile handling error:', profileErr);
          // Don't prevent login for profile issues
        }

        // Show success message briefly before redirect
        setMessage('Login successful! Redirecting...');
        setMessageType('success');

        // Small delay to show success message
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1000);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
      setSessionError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard'
        }
      });

      if (error) throw error;

      // OAuth redirect will handle the rest
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email address first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setMessage('Password reset instructions have been sent to your email.');
      setMessageType('success');
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100">
      <div className="max-w-md w-full p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl transition-all">
        <div className="text-center">
          <CheckCircleIcon className="mx-auto h-16 w-16 text-blue-500 mb-4" />
          <h2 className="text-3xl font-extrabold text-white">
            {sessionError ? 'Session Expired' : 'Welcome Back'}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {sessionError 
              ? 'Your session has expired. Please sign in again.' 
              : 'Sign in to your Taskie account'
            }
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-900 text-red-300 border border-red-700 p-4 rounded-md text-sm" role="alert">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                  {sessionError && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={refreshPage}
                        className="text-xs bg-red-800 hover:bg-red-700 px-2 py-1 rounded transition-colors"
                      >
                        Refresh Page
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {message && (
            <div
              className={`p-4 rounded-md text-sm ${messageType === 'success'
                ? 'bg-green-900 text-green-300 border border-green-700'
                : messageType === 'error'
                  ? 'bg-red-900 text-red-300 border border-red-700'
                  : 'bg-blue-900 text-blue-300 border border-blue-700'
                }`}
              role="alert"
            >
              <div className="flex items-start">
                <CheckCircleIcon className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
                <p className="font-medium">{message}</p>
              </div>
            </div>
          )}

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
              disabled={loading || googleLoading}
            />
          </div>

          <div className="relative">
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="input-field-dark transition-all pr-10"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading || googleLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
              disabled={loading || googleLoading}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn-primary w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Signing in...
              </div>
            ) : (
              'Sign in'
            )}
          </button>

          {/* Google Sign In Button */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full flex justify-center items-center px-4 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {googleLoading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin mr-2"></div>
                Signing in...
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading || googleLoading || !formData.email}
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Forgot password?
            </button>
          </div>

          <div className="text-center text-sm mt-6">
            <p className="text-gray-500">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}