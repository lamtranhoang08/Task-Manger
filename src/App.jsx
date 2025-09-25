// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import LoadingSpinner from "./components/common/LoadingSpinner";
import ErrorBoundary from "./components/common/ErrorBoundary";

// Lazy load components for better performance
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const TasksPage = React.lazy(() => import("./pages/TasksPage"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const SignupPage = React.lazy(() => import("./pages/SignupPage"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const WorkspacePage = React.lazy(() => import("./pages/WorkspacePage"));
const Sidebar = React.lazy(() => import("./components/common/Sidebar"));

// Constants for better maintainability
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
const ACTIVITY_THROTTLE = 1000; // 1 second
const INACTIVITY_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const SESSION_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 minutes

// Enhanced session cache with better structure
class SessionCache {
  constructor() {
    this.data = {
      user: null,
      profile: null,
      lastFetch: 0,
      lastRefresh: 0,
      isValid: false
    };
    this.listeners = new Set();
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.notifyListeners();
  }

  setMultiple(updates) {
    Object.assign(this.data, updates);
    this.notifyListeners();
  }

  isExpired() {
    return !this.data.isValid ||
      (Date.now() - this.data.lastFetch) > CACHE_TTL;
  }

  clear() {
    this.data = {
      user: null,
      profile: null,
      lastFetch: 0,
      lastRefresh: 0,
      isValid: false
    };
    this.notifyListeners();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.data));
  }
}

const sessionCache = new SessionCache();

// Enhanced error handling utility
const createError = (message, code = 'UNKNOWN_ERROR', details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.timestamp = new Date().toISOString();
  return error;
};

// Retry utility for network operations
const withRetry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on auth errors
      if (error.message?.includes('Invalid') || error.message?.includes('unauthorized')) {
        throw error;
      }

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
};

// Layout with enhanced error boundaries and performance optimizations
const Layout = React.memo(({ currentUser, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentPage = useCallback(() => {
    const path = location.pathname.replace("/", "");
    return path || "dashboard";
  }, [location.pathname]);

  const handlePageChange = useCallback((pageId) => {
    navigate(`/${pageId}`, { replace: false });
  }, [navigate]);

  const handleLogoutWithConfirmation = useCallback(async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await onLogout();
    }
  }, [onLogout]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50">
        <div className="w-64 flex-shrink-0 bg-white shadow-sm">
          <Suspense fallback={<div className="p-4"><LoadingSpinner size="sm" /></div>}>
            <Sidebar
              activePage={getCurrentPage()}
              onPageChange={handlePageChange}
              currentUser={currentUser}
              onLogout={handleLogoutWithConfirmation}
            />
          </Suspense>
        </div>
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-8"><LoadingSpinner /></div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </ErrorBoundary>
  );
});

Layout.displayName = 'Layout';

// Enhanced email confirmation handler with better error recovery
function EmailConfirmationHandler() {
  const [state, setState] = useState({
    confirming: true,
    error: null,
    countdown: 0
  });
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef();

  useEffect(() => {
    let isMounted = true;

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

        // Use retry mechanism for session establishment
        const sessionResult = await withRetry(async () => {
          return await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
        });

        const { data: { session }, error: sessionError } = sessionResult;

        if (sessionError) throw sessionError;
        if (!session?.user) throw createError('Failed to establish session', 'SESSION_ESTABLISHMENT_FAILED');

        if (isMounted) {
          // Update cache immediately
          sessionCache.setMultiple({
            user: session.user,
            lastFetch: Date.now(),
            lastRefresh: Date.now(),
            isValid: true
          });

          // Ensure profile exists
          await withRetry(async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profile) {
              const newProfile = {
                id: session.user.id,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                created_at: new Date().toISOString(),
              };

              await supabase.from('profiles').insert([newProfile]);
              sessionCache.set('profile', newProfile);
            } else {
              sessionCache.set('profile', profile);
            }
          });

          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Email confirmation error:', error);

        if (isMounted) {
          setState(prev => ({ ...prev, error: error.message, confirming: false }));

          // Enhanced countdown with user feedback
          let countdown = 5;
          setState(prev => ({ ...prev, countdown }));

          const countdownInterval = setInterval(() => {
            countdown--;
            if (isMounted) {
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
      }
    };

    const initTimeoutId = setTimeout(handleEmailConfirmation, 500);

    return () => {
      isMounted = false;
      clearTimeout(initTimeoutId);
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [navigate, location.search, location.hash]);

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
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login Now
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// Enhanced activity tracker hook
const useActivityTracker = (onInactivity, isEnabled) => {
  const lastActivityRef = useRef(Date.now());
  const throttleTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  const updateActivity = useCallback(() => {
    if (throttleTimerRef.current) return;

    throttleTimerRef.current = setTimeout(() => {
      lastActivityRef.current = Date.now();
      throttleTimerRef.current = null;
    }, ACTIVITY_THROTTLE);
  }, []);

  const checkInactivity = useCallback(() => {
    if (!isEnabled) return;

    const inactive = Date.now() - lastActivityRef.current;
    if (inactive > INACTIVITY_TIMEOUT) {
      onInactivity();
    }
  }, [onInactivity, isEnabled]);

  useEffect(() => {
    if (!isEnabled) return;

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));

    const interval = setInterval(checkInactivity, INACTIVITY_CHECK_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [updateActivity, checkInactivity, isEnabled]);

  return lastActivityRef.current;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecking, setSessionChecking] = useState(false);
  const [error, setError] = useState(null);
  const authSubscriptionRef = useRef(null);
  const componentMountedRef = useRef(true);

  // Enhanced profile fetching with better error handling
  const fetchUserProfile = useCallback(async (user, forceRefresh = false) => {
    try {
      // Use cached profile if available and valid
      if (!forceRefresh && !sessionCache.isExpired() && sessionCache.get('profile') && sessionCache.get('user')?.id === user.id) {
        const profile = sessionCache.get('profile');
        const userName = profile.name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";

        setCurrentUser({
          id: user.id,
          email: user.email,
          name: userName,
          avatar: profile.avatar_url || null,
        });
        return;
      }

      // Fetch fresh profile data with retry
      const profileData = await withRetry(async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        return data;
      });

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

      // Fallback without caching on error
      if (componentMountedRef.current) {
        setCurrentUser({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar: null,
        });
        setError(err.message);
      }
    }
  }, []);

  // Enhanced logout with better cleanup
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

  // Enhanced inactivity handler
  const handleInactivity = useCallback(() => {
    handleLogout();
    // Show a more user-friendly notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Session Expired', {
        body: 'You have been logged out due to inactivity.',
        icon: '/favicon.ico'
      });
    } else {
      alert("You have been logged out due to inactivity.");
    }
  }, [handleLogout]);

  // Use the enhanced activity tracker
  useActivityTracker(handleInactivity, !!currentUser);

  // Enhanced session checking with better error handling - REMOVED TO PREVENT LOOPS
  // This function is now inlined where needed to prevent dependency issues

  // Page visibility handling for session refresh - FIXED DEPENDENCIES
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUser) {
        // Inline session check to avoid dependency issues
        if (sessionChecking) return;

        const checkSessionOnVisibility = async () => {
          try {
            setSessionChecking(true);

            // Use cached session if valid
            if (!sessionCache.isExpired() && sessionCache.get('user')) {
              const cachedUser = sessionCache.get('user');
              await fetchUserProfile(cachedUser);
              return;
            }

            // Fetch fresh session
            const sessionData = await withRetry(async () => {
              const { data, error } = await supabase.auth.getSession();
              if (error) throw error;
              return data;
            });

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
            sessionCache.clear();
            if (componentMountedRef.current) {
              setCurrentUser(null);
              setError(err.message);
            }
          } finally {
            if (componentMountedRef.current) {
              setSessionChecking(false);
            }
          }
        };

        checkSessionOnVisibility();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, sessionChecking]); // Only depend on currentUser and sessionChecking

  // Enhanced session refresh logic
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      const lastRefresh = sessionCache.get('lastRefresh') || 0;
      const shouldRefresh = Date.now() - lastRefresh > SESSION_REFRESH_THRESHOLD;

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
    }, SESSION_REFRESH_THRESHOLD);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Initialize auth with enhanced error handling - FIXED DEPENDENCIES
  useEffect(() => {
    componentMountedRef.current = true;

    const initializeAuth = async () => {
      try {
        // Call checkSession directly without dependencies
        if (sessionChecking) return;

        try {
          setSessionChecking(true);

          // Use cached session if valid
          if (!sessionCache.isExpired() && sessionCache.get('user')) {
            const cachedUser = sessionCache.get('user');
            await fetchUserProfile(cachedUser);
            return;
          }

          // Fetch fresh session with retry
          const sessionData = await withRetry(async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data;
          });

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
          sessionCache.clear();
          if (componentMountedRef.current) {
            setCurrentUser(null);
            setError(err.message);
          }
        } finally {
          if (componentMountedRef.current) {
            setSessionChecking(false);
          }
        }

        // Set up auth listener with better event handling
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
                  // Only fetch profile if user changed or we don't have current user
                  const currentUserId = componentMountedRef.current ? currentUser?.id : null;
                  if (!currentUserId || currentUserId !== session.user.id) {
                    await fetchUserProfile(session.user);
                  }
                }
                break;

              case 'USER_UPDATED':
                if (session?.user) {
                  const currentUserId = componentMountedRef.current ? currentUser?.id : null;
                  if (currentUserId === session.user.id) {
                    await fetchUserProfile(session.user, true);
                  }
                }
                break;
            }
          } catch (err) {
            console.error('Auth state change error:', err);
            if (componentMountedRef.current) {
              setError(err.message);
            }
          }
        });

        authSubscriptionRef.current = data.subscription;
      } catch (err) {
        console.error("Auth init error:", err);
        if (componentMountedRef.current) {
          setError(err.message);
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
    };
  }, []); // Empty dependency array - only run once on mount

  const refreshUserData = useCallback(async () => {
    if (currentUser) {
      // Inline to avoid circular dependencies
      try {
        // Fetch fresh profile data with retry
        const profileData = await withRetry(async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("id", currentUser.id)
            .maybeSingle();

          if (error) throw error;
          return data;
        });

        const userName = profileData?.name ||
          currentUser.name ||
          currentUser.email?.split("@")[0] ||
          "User";

        const userObj = {
          id: currentUser.id,
          email: currentUser.email,
          name: userName,
          avatar: profileData?.avatar_url || null,
        };

        // Update cache
        sessionCache.setMultiple({
          user: { ...currentUser },
          profile: profileData || { name: userName },
          lastFetch: Date.now(),
          isValid: true
        });

        if (componentMountedRef.current) {
          setCurrentUser(userObj);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to refresh profile:", err);
        if (componentMountedRef.current) {
          setError(err.message);
        }
      }
    }
  }, [currentUser]); // Only depend on currentUser

  // Memoized routes with enhanced error boundaries
  const routes = useMemo(() => (
    <Routes>
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

      {currentUser ? (
        <>
          <Route
            path="/dashboard"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <DashboardPage currentUser={currentUser} />
              </Layout>
            }
          />
          <Route
            path="/workspace"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <WorkspacePage currentUser={currentUser} />
              </Layout>
            }
          />
          <Route
            path="/tasks"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <TasksPage currentUser={currentUser} />
              </Layout>
            }
          />
          <Route
            path="/settings"
            element={
              <Layout currentUser={currentUser} onLogout={handleLogout}>
                <ProfilePage currentUser={currentUser} onProfileUpdate={refreshUserData} />
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
  ), [currentUser, handleLogout, refreshUserData]);

  if (loading || sessionChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-slate-600 font-medium">Loading Taskie...</p>
          {error && (
            <p className="mt-2 text-red-500 text-sm">Experiencing connection issues...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
            <LoadingSpinner />
          </div>
        }>
          {routes}
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}