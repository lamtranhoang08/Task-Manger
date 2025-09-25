// src/App.jsx - Production Ready with Enhanced Session Management and Error Handling
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import LoadingSpinner from "./components/common/LoadingSpinner";
import ErrorBoundary from "./components/common/ErrorBoundary";

// ============================================================================
// LAZY LOADED COMPONENTS FOR PERFORMANCE
// ============================================================================

const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const TasksPage = React.lazy(() => import("./pages/TasksPage"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const SignupPage = React.lazy(() => import("./pages/SignupPage"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const WorkspacePage = React.lazy(() => import("./pages/WorkspacePage"));
const Sidebar = React.lazy(() => import("./components/common/Sidebar"));

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

/**
 * Application configuration constants
 */
const CONFIG = {
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  INACTIVITY_TIMEOUT: 60 * 60 * 1000, // 1 hour
  ACTIVITY_THROTTLE: 1000, // 1 second
  INACTIVITY_CHECK_INTERVAL: 10 * 60 * 1000, // 10 minutes
  SESSION_REFRESH_THRESHOLD: 30 * 60 * 1000, // 30 minutes
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  SESSION_CHECK_DEBOUNCE: 2000, // 2 seconds
  PROFILE_FETCH_TIMEOUT: 10000 // 10 seconds
};

/**
 * Default session cache structure
 */
const DEFAULT_CACHE_DATA = {
  user: null,
  profile: null,
  lastFetch: 0,
  lastRefresh: 0,
  isValid: false,
  lastActivity: Date.now()
};

// ============================================================================
// ENHANCED SESSION CACHE WITH BETTER PERFORMANCE
// ============================================================================

/**
 * Enhanced session cache with event-driven updates and better error handling
 */
class SessionCache {
  constructor() {
    this.data = { ...DEFAULT_CACHE_DATA };
    this.listeners = new Set();
    this.operationLocks = new Map(); // Prevent concurrent operations
  }

  /**
   * Get a value from cache
   */
  get(key) {
    return this.data[key];
  }

  /**
   * Set a single value in cache
   */
  set(key, value) {
    this.data[key] = value;
    this.notifyListeners();
  }

  /**
   * Set multiple values atomically
   */
  setMultiple(updates) {
    Object.assign(this.data, updates);
    this.notifyListeners();
  }

  /**
   * Check if cache is expired
   */
  isExpired() {
    return !this.data.isValid || (Date.now() - this.data.lastFetch) > CONFIG.CACHE_TTL;
  }

  /**
   * Check if user data is stale
   */
  isUserStale(userId) {
    return !this.data.user || this.data.user.id !== userId || this.isExpired();
  }

  /**
   * Clear cache and notify listeners
   */
  clear() {
    this.data = { ...DEFAULT_CACHE_DATA };
    this.operationLocks.clear();
    this.notifyListeners();
  }

  /**
   * Subscribe to cache changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.data);
      } catch (error) {
        console.error('Cache listener error:', error);
      }
    });
  }

  /**
   * Acquire operation lock to prevent concurrent operations
   */
  acquireLock(operation) {
    if (this.operationLocks.has(operation)) {
      return false; // Already locked
    }
    this.operationLocks.set(operation, Date.now());
    return true;
  }

  /**
   * Release operation lock
   */
  releaseLock(operation) {
    this.operationLocks.delete(operation);
  }

  /**
   * Check if operation is locked
   */
  isLocked(operation) {
    return this.operationLocks.has(operation);
  }
}

// Global session cache instance
const sessionCache = new SessionCache();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Enhanced error creation with context
 */
const createError = (message, code = 'UNKNOWN_ERROR', details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.timestamp = new Date().toISOString();
  return error;
};

/**
 * Retry utility for network operations with exponential backoff
 */
const withRetry = async (fn, maxRetries = CONFIG.MAX_RETRIES, baseDelay = CONFIG.RETRY_DELAY) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message?.includes('Invalid') || 
          error.message?.includes('unauthorized') ||
          error.name === 'AbortError') {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

/**
 * Debounce utility for preventing rapid function calls
 */
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Timeout wrapper for promises
 */
const withTimeout = (promise, timeoutMs, errorMessage = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(createError(errorMessage, 'TIMEOUT')), timeoutMs)
    )
  ]);
};

// ============================================================================
// ENHANCED LAYOUT COMPONENT
// ============================================================================

/**
 * Layout component with enhanced error boundaries and performance optimizations
 */
const Layout = React.memo(({ currentUser, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Get current page from pathname
   */
  const getCurrentPage = useCallback(() => {
    const path = location.pathname.replace("/", "");
    return path || "dashboard";
  }, [location.pathname]);

  /**
   * Handle page navigation with error recovery
   */
  const handlePageChange = useCallback((pageId) => {
    try {
      navigate(`/${pageId}`, { replace: false });
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to direct URL change
      window.location.href = `/${pageId}`;
    }
  }, [navigate]);

  /**
   * Handle logout without confirmation (as requested)
   */
  const handleDirectLogout = useCallback(async () => {
    await onLogout();
  }, [onLogout]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 bg-white shadow-sm">
          <Suspense 
            fallback={
              <div className="p-4 flex items-center justify-center">
                <LoadingSpinner size="sm" />
              </div>
            }
          >
            <Sidebar
              activePage={getCurrentPage()}
              onPageChange={handlePageChange}
              currentUser={currentUser}
              onLogout={handleDirectLogout}
            />
          </Suspense>
        </div>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense 
            fallback={
              <div className="p-8 flex items-center justify-center">
                <LoadingSpinner />
                <span className="ml-3 text-slate-600">Loading page...</span>
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </ErrorBoundary>
  );
});

Layout.displayName = 'Layout';

// ============================================================================
// EMAIL CONFIRMATION HANDLER
// ============================================================================

/**
 * Enhanced email confirmation handler with better error recovery
 */
function EmailConfirmationHandler() {
  const [state, setState] = useState({
    confirming: true,
    error: null,
    countdown: 0
  });
  
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    /**
     * Handle email confirmation process
     */
    const handleEmailConfirmation = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const fragment = new URLSearchParams(location.hash.substring(1));

        const accessToken = urlParams.get('access_token') || fragment.get('access_token');
        const refreshToken = urlParams.get('refresh_token') || fragment.get('refresh_token');
        const type = urlParams.get('type') || fragment.get('type');

        if (!accessToken || type !== 'signup') {
          throw createError('Invalid confirmation link', 'INVALID_CONFIRMATION_LINK');
        }

        // Set session with timeout
        const sessionResult = await withTimeout(
          withRetry(async () => {
            return await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
          }),
          CONFIG.PROFILE_FETCH_TIMEOUT
        );

        const { data: { session }, error: sessionError } = sessionResult;

        if (sessionError) throw sessionError;
        if (!session?.user) {
          throw createError('Failed to establish session', 'SESSION_ESTABLISHMENT_FAILED');
        }

        if (!mountedRef.current) return;

        // Update cache immediately
        sessionCache.setMultiple({
          user: session.user,
          lastFetch: Date.now(),
          lastRefresh: Date.now(),
          isValid: true
        });

        // Ensure profile exists with timeout
        await withTimeout(
          withRetry(async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, name, avatar_url')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profile) {
              const newProfile = {
                id: session.user.id,
                name: session.user.user_metadata?.name || 
                      session.user.email?.split('@')[0] || 
                      'User',
                email: session.user.email,
                created_at: new Date().toISOString(),
              };

              const { error: insertError } = await supabase
                .from('profiles')
                .insert([newProfile]);

              if (insertError) throw insertError;
              sessionCache.set('profile', newProfile);
            } else {
              sessionCache.set('profile', profile);
            }
          }),
          CONFIG.PROFILE_FETCH_TIMEOUT
        );

        // Navigate to dashboard
        navigate('/dashboard', { replace: true });

      } catch (error) {
        console.error('Email confirmation error:', error);

        if (!mountedRef.current) return;

        setState(prev => ({ 
          ...prev, 
          error: error.message, 
          confirming: false 
        }));

        // Start countdown for redirect
        let countdown = 5;
        setState(prev => ({ ...prev, countdown }));

        const countdownInterval = setInterval(() => {
          countdown--;
          if (mountedRef.current) {
            setState(prev => ({ ...prev, countdown }));

            if (countdown <= 0) {
              clearInterval(countdownInterval);
              navigate('/login', {
                state: {
                  message: error.code === 'INVALID_CONFIRMATION_LINK'
                    ? 'Invalid confirmation link. Please try signing up again.'
                    : 'Email confirmed! Please sign in to continue.',
                  type: error.code === 'INVALID_CONFIRMATION_LINK' ? 'error' : 'success'
                },
                replace: true
              });
            }
          } else {
            clearInterval(countdownInterval);
          }
        }, 1000);

        timeoutRef.current = countdownInterval;
      }
    };

    // Start confirmation process after brief delay
    const initTimeoutId = setTimeout(handleEmailConfirmation, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimeoutId);
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
    };
  }, [navigate, location.search, location.hash]);

  // Render confirming state
  if (state.confirming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
          <LoadingSpinner />
          <p className="mt-4 text-slate-600 font-medium">Confirming your email...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait while we verify your account</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Confirmation Issue</h2>
          <p className="text-red-600 mb-4 text-sm">{state.error}</p>
          <p className="text-slate-600 text-sm mb-4">
            Redirecting in {state.countdown} seconds...
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Login Now
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// ACTIVITY TRACKING HOOK
// ============================================================================

/**
 * Enhanced activity tracker hook with better performance
 */
const useActivityTracker = (onInactivity, isEnabled) => {
  const lastActivityRef = useRef(Date.now());
  const throttleTimerRef = useRef(null);
  const checkIntervalRef = useRef(null);

  /**
   * Update last activity timestamp (throttled)
   */
  const updateActivity = useCallback(() => {
    if (throttleTimerRef.current) return;

    throttleTimerRef.current = setTimeout(() => {
      lastActivityRef.current = Date.now();
      sessionCache.set('lastActivity', Date.now());
      throttleTimerRef.current = null;
    }, CONFIG.ACTIVITY_THROTTLE);
  }, []);

  /**
   * Check for user inactivity
   */
  const checkInactivity = useCallback(() => {
    if (!isEnabled) return;

    const inactive = Date.now() - lastActivityRef.current;
    if (inactive > CONFIG.INACTIVITY_TIMEOUT) {
      console.log('User inactive for', inactive, 'ms, triggering logout');
      onInactivity();
    }
  }, [onInactivity, isEnabled]);

  useEffect(() => {
    if (!isEnabled) return;

    // Activity event listeners
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Inactivity check interval
    checkIntervalRef.current = setInterval(checkInactivity, CONFIG.INACTIVITY_CHECK_INTERVAL);

    return () => {
      // Cleanup event listeners
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      
      // Cleanup timers
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [updateActivity, checkInactivity, isEnabled]);

  return lastActivityRef.current;
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  // ========================================================================
  // STATE AND REFS
  // ========================================================================
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecking, setSessionChecking] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for cleanup and operation management
  const authSubscriptionRef = useRef(null);
  const componentMountedRef = useRef(true);
  const sessionRefreshIntervalRef = useRef(null);
  const timeoutRefs = useRef(new Set());

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Safe setTimeout that tracks IDs for cleanup
   */
  const safeSetTimeout = useCallback((callback, delay) => {
    const timeoutId = setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      callback();
    }, delay);
    
    timeoutRefs.current.add(timeoutId);
    return timeoutId;
  }, []);

  /**
   * Cleanup all pending timeouts
   */
  const cleanupTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
  }, []);

  // ========================================================================
  // PROFILE MANAGEMENT
  // ========================================================================

  /**
   * Enhanced profile fetching with timeout and better error handling
   */
  const fetchUserProfile = useCallback(async (user, forceRefresh = false) => {
    if (!user?.id || !componentMountedRef.current) return;

    // Check if we can use cached data
    if (!forceRefresh && !sessionCache.isUserStale(user.id)) {
      const profile = sessionCache.get('profile');
      const userName = profile?.name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

      setCurrentUser({
        id: user.id,
        email: user.email,
        name: userName,
        avatar: profile?.avatar_url || null,
      });
      return;
    }

    // Acquire lock to prevent concurrent profile fetches
    if (!sessionCache.acquireLock('profileFetch')) {
      return; // Another fetch is already in progress
    }

    try {
      // Fetch profile data with timeout and retry
      const profileData = await withTimeout(
        withRetry(async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("id", user.id)
            .maybeSingle();

          if (error) throw error;
          return data;
        }),
        CONFIG.PROFILE_FETCH_TIMEOUT
      );

      const userName = profileData?.name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

      const userObj = {
        id: user.id,
        email: user.email,
        name: userName,
        avatar: profileData?.avatar_url || null,
      };

      // Update cache
      sessionCache.setMultiple({
        user: user,
        profile: profileData || { name: userName },
        lastFetch: Date.now(),
        isValid: true
      });

      if (componentMountedRef.current) {
        setCurrentUser(userObj);
        setError(null);
      }

    } catch (err) {
      console.error("Failed to fetch profile:", err);

      // Fallback user object
      const fallbackUser = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || 
              user.email?.split("@")[0] || 
              "User",
        avatar: null,
      };

      if (componentMountedRef.current) {
        setCurrentUser(fallbackUser);
        
        // Only show error for critical failures, not timeouts
        if (err.code !== 'TIMEOUT') {
          setError('Failed to load profile. Some features may be limited.');
        }
      }
    } finally {
      sessionCache.releaseLock('profileFetch');
    }
  }, []);

  // ========================================================================
  // SESSION MANAGEMENT
  // ========================================================================

  /**
   * Debounced session check to prevent rapid consecutive calls
   */
  const checkSession = useMemo(
    () => debounce(async (forceRefresh = false) => {
      if (!componentMountedRef.current || sessionCache.isLocked('sessionCheck')) {
        return;
      }

      // Acquire lock
      if (!sessionCache.acquireLock('sessionCheck')) {
        return;
      }

      try {
        setSessionChecking(true);

        // Use cached session if valid and not forcing refresh
        if (!forceRefresh && !sessionCache.isExpired()) {
          const cachedUser = sessionCache.get('user');
          if (cachedUser) {
            await fetchUserProfile(cachedUser);
            return;
          }
        }

        // Fetch fresh session
        const sessionData = await withTimeout(
          withRetry(async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data;
          }),
          CONFIG.PROFILE_FETCH_TIMEOUT
        );

        if (sessionData.session?.user) {
          await fetchUserProfile(sessionData.session.user);
        } else {
          sessionCache.clear();
          if (componentMountedRef.current) {
            setCurrentUser(null);
          }
        }

      } catch (err) {
        console.error("Session check error:", err);
        
        // Clear cache and state on session errors
        sessionCache.clear();
        
        if (componentMountedRef.current) {
          setCurrentUser(null);
          
          // Show error only for non-timeout failures
          if (err.code !== 'TIMEOUT') {
            setError('Session expired. Please sign in again.');
          }
        }
      } finally {
        sessionCache.releaseLock('sessionCheck');
        
        if (componentMountedRef.current) {
          setSessionChecking(false);
        }
      }
    }, CONFIG.SESSION_CHECK_DEBOUNCE),
    [fetchUserProfile]
  );

  // ========================================================================
  // LOGOUT FUNCTIONALITY
  // ========================================================================

  /**
   * Enhanced logout with better cleanup (no confirmation as requested)
   */
  const handleLogout = useCallback(async () => {
    try {
      // Clear cache and state immediately
      sessionCache.clear();
      setCurrentUser(null);
      setError(null);

      // Sign out from Supabase with retry
      await withRetry(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }, 2, 500);

    } catch (err) {
      console.error("Logout failed:", err);
      
      // Even if logout fails, clear local state
      sessionCache.clear();
      setCurrentUser(null);
    }
  }, []);

  // ========================================================================
  // INACTIVITY HANDLING
  // ========================================================================

  /**
   * Handle user inactivity with better UX
   */
  const handleInactivity = useCallback(() => {
    console.log('User inactivity detected, logging out...');
    handleLogout();
    
    // Show user-friendly notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Session Expired', {
        body: 'You have been logged out due to inactivity.',
        icon: '/favicon.ico'
      });
    }
    
    // Set a user-friendly error message
    setError('You have been logged out due to inactivity.');
  }, [handleLogout]);

  // Use activity tracker
  useActivityTracker(handleInactivity, !!currentUser);

  // ========================================================================
  // PROFILE REFRESH
  // ========================================================================

  /**
   * Refresh user profile data
   */
  const refreshUserData = useCallback(async () => {
    if (currentUser?.id) {
      await fetchUserProfile({ 
        id: currentUser.id, 
        email: currentUser.email 
      }, true);
    }
  }, [currentUser?.id, currentUser?.email, fetchUserProfile]);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  /**
   * Page visibility handling for session refresh
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUser && !sessionChecking) {
        checkSession(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, sessionChecking, checkSession]);

  /**
   * Session refresh interval
   */
  useEffect(() => {
    if (!currentUser) return;

    sessionRefreshIntervalRef.current = setInterval(async () => {
      const lastRefresh = sessionCache.get('lastRefresh') || 0;
      const shouldRefresh = Date.now() - lastRefresh > CONFIG.SESSION_REFRESH_THRESHOLD;

      if (shouldRefresh) {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            sessionCache.set('lastRefresh', Date.now());
          }
        } catch (err) {
          console.error('Session refresh failed:', err);
        }
      }
    }, CONFIG.SESSION_REFRESH_THRESHOLD);

    return () => {
      if (sessionRefreshIntervalRef.current) {
        clearInterval(sessionRefreshIntervalRef.current);
        sessionRefreshIntervalRef.current = null;
      }
    };
  }, [currentUser]);

  /**
   * Initialize authentication and set up listeners
   */
  useEffect(() => {
    componentMountedRef.current = true;

    const initializeAuth = async () => {
      try {
        // Initial session check
        await checkSession(false);

        // Set up auth state listener
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!componentMountedRef.current) return;

          console.log('Auth state change:', event, session?.user?.id);

          try {
            switch (event) {
              case 'SIGNED_IN':
                if (session?.user) {
                  await fetchUserProfile(session.user);
                }
                break;

              case 'SIGNED_OUT':
                sessionCache.clear();
                if (componentMountedRef.current) {
                  setCurrentUser(null);
                  setError(null);
                }
                break;

              case 'TOKEN_REFRESHED':
                if (session?.user) {
                  sessionCache.set('lastRefresh', Date.now());
                  
                  // Only fetch profile if user changed
                  const currentUserId = currentUser?.id;
                  if (!currentUserId || currentUserId !== session.user.id) {
                    await fetchUserProfile(session.user);
                  }
                }
                break;

              case 'USER_UPDATED':
                if (session?.user && session.user.id === currentUser?.id) {
                  await fetchUserProfile(session.user, true);
                }
                break;
            }
          } catch (err) {
            console.error('Auth state change error:', err);
            if (componentMountedRef.current) {
              setError('Authentication error occurred.');
            }
          }
        });

        authSubscriptionRef.current = data.subscription;

      } catch (err) {
        console.error("Auth initialization error:", err);
        if (componentMountedRef.current) {
          setError('Failed to initialize authentication.');
        }
      } finally {
        if (componentMountedRef.current) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      componentMountedRef.current = false;
      authSubscriptionRef.current?.unsubscribe();
      cleanupTimeouts();
      if (sessionRefreshIntervalRef.current) {
        clearInterval(sessionRefreshIntervalRef.current);
      }
    };
  }, []); // Empty dependency array - only run on mount

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  /**
   * Memoized routes with enhanced error boundaries
   */
  const routes = useMemo(() => (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={currentUser ? <Navigate to="/dashboard" replace /> : <SignupPage />}
      />
      <Route
        path="/auth/confirm"
        element={<EmailConfirmationHandler />}
      />

      {/* Protected routes */}
      {currentUser ? (
        <>
          <Route
            path="/dashboard"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <DashboardPage 
                  currentUser={currentUser} 
                  onAuthStateChange={(session, user) => {
                    if (user) fetchUserProfile(user);
                  }}
                />
              </Layout>
            }
          />
          <Route
            path="/workspace"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <WorkspacePage 
                  currentUser={currentUser}
                  onAuthStateChange={(session, user) => {
                    if (user) fetchUserProfile(user);
                  }}
                />
              </Layout>
            }
          />
          <Route
            path="/tasks"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <TasksPage 
                  currentUser={currentUser}
                  onAuthStateChange={(session, user) => {
                    if (user) fetchUserProfile(user);
                  }}
                />
              </Layout>
            }
          />
          <Route
            path="/settings"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <ProfilePage 
                  currentUser={currentUser} 
                  onProfileUpdate={refreshUserData} 
                />
              </Layout>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  ), [currentUser, handleLogout, fetchUserProfile, refreshUserData]);

  /**
   * Loading screen component
   */
  const LoadingScreen = useMemo(() => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-slate-600 font-medium">Loading Taskie...</p>
        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200 max-w-sm mx-auto">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => checkSession(true)}
              disabled={sessionChecking}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  ), [error, sessionChecking, checkSession]);

  /**
   * Suspense fallback component
   */
  const SuspenseFallback = useMemo(() => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="flex items-center space-x-3">
        <LoadingSpinner />
        <span className="text-slate-600 font-medium">Loading...</span>
      </div>
    </div>
  ), []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Show loading screen during initial load
  if (loading || sessionChecking) {
    return LoadingScreen;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={SuspenseFallback}>
          {routes}
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}