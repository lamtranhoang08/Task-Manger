"use client";

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  CheckCircleIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ExclamationTriangleIcon,
  CheckIcon
} from "@heroicons/react/24/outline";

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isFormValid, setIsFormValid] = useState(false);
  const navigate = useNavigate();

  // Real-time password strength checker
  const checkPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  // Real-time form validation
  useEffect(() => {
    const errors = {};
    
    // Name validation
    if (formData.name && formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    // Confirm password validation
    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFieldErrors(errors);
    setPasswordStrength(checkPasswordStrength(formData.password));
    
    // Check if form is valid
    const isValid = formData.name.trim().length >= 2 &&
                   /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
                   formData.password.length >= 6 &&
                   formData.password === formData.confirmPassword &&
                   Object.keys(errors).length === 0;
    
    setIsFormValid(isValid);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear general error when user starts typing
    if (error) setError('');
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) throw error;
      
    } catch (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setError('Please fix the errors above before submitting.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password.trim(),
        options: {
          data: {
            name: formData.name.trim()
          },
          emailRedirectTo: `${window.location.origin}/verify-email`
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('An account with this email already exists. Try signing in instead.');
        }
        throw authError;
      }

      // Create profile
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
          console.warn('Profile creation failed:', profileError.message);
        }
      } catch (profileErr) {
        console.warn('Profile creation error:', profileErr.message);
      }
      
      setSuccess('🎉 Account created successfully! Check your email for a verification link to get started.');
      
      // Auto-redirect after success
      setTimeout(() => {
        navigate('/login', { state: { message: 'Please verify your email before signing in.' } });
      }, 3000);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-red-500';
    if (passwordStrength <= 2) return 'bg-yellow-500';
    if (passwordStrength <= 3) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 2) return 'Fair';
    if (passwordStrength <= 3) return 'Good';
    return 'Strong';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 p-4">
      <div className="max-w-md w-full space-y-8 bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 p-8">
        <div className="text-center">
          <CheckCircleIcon className="mx-auto h-16 w-16 text-blue-500 mb-4 animate-pulse" />
          <h2 className="text-3xl font-extrabold text-white mb-2">Join Taskie</h2>
          <p className="text-sm text-gray-400">
            Create your account and start organizing your life
          </p>
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 rounded-xl px-4 py-3.5 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
              Connecting...
            </>
          ) : (
            'Continue with Google'
          )}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-800 text-gray-400">Or continue with email</span>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {/* Global Error */}
          {error && (
            <div className="bg-red-900/50 text-red-300 border border-red-700/50 p-4 rounded-xl text-sm backdrop-blur-sm" role="alert">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-900/50 text-green-300 border border-green-700/50 p-4 rounded-xl text-sm backdrop-blur-sm" role="alert">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-5 w-5 flex-shrink-0" />
                <p className="font-medium">{success}</p>
              </div>
            </div>
          )}

          {/* Name Field */}
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium text-gray-300">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className={`w-full px-4 py-3.5 bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm ${
                fieldErrors.name ? 'border-red-500' : 'border-gray-600 hover:border-gray-500'
              }`}
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="name-error" className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" />
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`w-full px-4 py-3.5 bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm ${
                fieldErrors.email ? 'border-red-500' : 'border-gray-600 hover:border-gray-500'
              }`}
              placeholder="Enter your email address"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className={`w-full px-4 py-3.5 pr-12 bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm ${
                  fieldErrors.password ? 'border-red-500' : 'border-gray-600 hover:border-gray-500'
                }`}
                placeholder="Create a secure password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                aria-describedby={fieldErrors.password ? 'password-error' : 'password-strength'}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {formData.password && (
              <div id="password-strength" className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Password strength</span>
                  <span className={`font-medium ${passwordStrength >= 3 ? 'text-green-400' : passwordStrength >= 2 ? 'text-blue-400' : 'text-yellow-400'}`}>
                    {getPasswordStrengthText()}
                  </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {fieldErrors.password && (
              <p id="password-error" className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className={`w-full px-4 py-3.5 pr-12 bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm ${
                  fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-600 hover:border-gray-500'
                }`}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p id="confirm-password-error" className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" />
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className={`w-full py-3.5 px-4 rounded-xl font-medium transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
              isFormValid && !loading
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating account...
              </div>
            ) : (
              'Create Account'
            )}
          </button>

          {/* Sign In Link */}
          <div className="text-center text-sm pt-4">
            <p className="text-gray-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors focus:underline"
              >
                Sign in instead
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}