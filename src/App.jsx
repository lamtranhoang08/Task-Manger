// src/App.jsx - Optimized Session Management
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import DashboardPage from "./pages/DashboardPage";
import TasksPage from "./pages/TasksPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProfilePage from "./pages/ProfilePage";
import LoadingSpinner from "./components/common/LoadingSpinner";
import WorkspacePage from "./pages/WorkspacePage";
import Sidebar from "./components/common/Sidebar";

// Session cache to prevent unnecessary refetching
const sessionCache = {
  user: null,
  profile: null,
  lastFetch: 0,
  isValid: false,
  TTL: 5 * 60 * 1000 // 5 minutes cache
};

// Layout with sidebar
const Layout = React.memo(({ currentUser, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentPage = useCallback(() => {
    const path = location.pathname.replace("/", "");
    return path || "dashboard";
  }, [location.pathname]);

  const handlePageChange = useCallback((pageId) => {
    navigate(`/${pageId}`);
  }, [navigate]);

  return (
    <div className="flex h-screen">
      <div className="w-64 flex-shrink-0">
        <Sidebar
          activePage={getCurrentPage()}
          onPageChange={handlePageChange}
          currentUser={currentUser}
          onLogout={onLogout}
        />
      </div>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
});

// Email confirmation handler component
function EmailConfirmationHandler() {
  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const handleEmailConfirmation = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const fragment = new URLSearchParams(location.hash.substring(1));
        
        const accessToken = urlParams.get('access_token') || fragment.get('access_token');
        const refreshToken = urlParams.get('refresh_token') || fragment.get('refresh_token');
        const type = urlParams.get('type') || fragment.get('type');
        
        if (!accessToken || type !== 'signup') {
          throw new Error('Invalid confirmation link');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (sessionError) throw sessionError;

        if (session?.user && isMounted) {
          // Update cache immediately
          sessionCache.user = session.user;
          sessionCache.lastFetch = Date.now();
          sessionCache.isValid = true;

          // Create profile if needed
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
            sessionCache.profile = newProfile;
          }

          navigate('/dashboard', { replace: true });
        } else {
          throw new Error('Failed to establish session');
        }
      } catch (error) {
        console.error('Email confirmation error:', error);
        
        if (isMounted) {
          setError(error.message);
          
          timeoutId = setTimeout(() => {
            if (isMounted) {
              navigate('/login', {
                state: {
                  message: error.message.includes('Invalid') 
                    ? 'Invalid confirmation link. Please try signing up again.' 
                    : 'Email confirmed! Please sign in to continue.',
                  type: error.message.includes('Invalid') ? 'error' : 'success'
                },
                replace: true
              });
            }
          }, 2000);
        }
      } finally {
        if (isMounted) setConfirming(false);
      }
    };

    const initTimeoutId = setTimeout(handleEmailConfirmation, 500);

    return () => {
      isMounted = false;
      if (initTimeoutId) clearTimeout(initTimeoutId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [navigate, location.search, location.hash]);

  if (confirming) {
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Confirmation Issue</h2>
          <p className="text-red-600 mb-4 text-sm">{error}</p>
          <p className="text-slate-600 text-sm mb-4">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sessionChecking, setSessionChecking] = useState(false);

  // Check if cached session is still valid
  const isCacheValid = useCallback(() => {
    return sessionCache.isValid && 
           sessionCache.user && 
           (Date.now() - sessionCache.lastFetch) < sessionCache.TTL;
  }, []);

  // Optimized profile fetching with caching
  const fetchUserProfile = useCallback(async (user, forceRefresh = false) => {
    try {
      // Use cached profile if available and valid
      if (!forceRefresh && sessionCache.profile && sessionCache.user?.id === user.id && isCacheValid()) {
        const userName = sessionCache.profile.name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";

        setCurrentUser({
          id: user.id,
          email: user.email,
          name: userName,
          avatar: sessionCache.profile.avatar_url || null,
        });
        return;
      }

      // Fetch fresh profile data
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

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
      sessionCache.user = user;
      sessionCache.profile = profileData || { name: userName };
      sessionCache.lastFetch = Date.now();
      sessionCache.isValid = true;

      setCurrentUser(userObj);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      
      // Fallback without caching on error
      setCurrentUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatar: null,
      });
    }
  }, [isCacheValid]);

  // Optimized logout with cache clearing
  const handleLogout = useCallback(async () => {
    try {
      // Clear cache immediately
      sessionCache.user = null;
      sessionCache.profile = null;
      sessionCache.isValid = false;
      sessionCache.lastFetch = 0;
      
      // Clear user state immediately
      setCurrentUser(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
      }
      
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }, []);

  // Optimized session checking
  const checkSession = useCallback(async (showLoading = true) => {
    if (sessionChecking) return; // Prevent concurrent checks
    
    try {
      if (showLoading) setSessionChecking(true);
      
      // Use cached session if valid
      if (isCacheValid()) {
        await fetchUserProfile(sessionCache.user);
        return;
      }

      // Fetch fresh session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Session error:", error);
        sessionCache.isValid = false;
        setCurrentUser(null);
        return;
      }
      
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        sessionCache.isValid = false;
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("Session check error:", err);
      sessionCache.isValid = false;
      setCurrentUser(null);
    } finally {
      if (showLoading) setSessionChecking(false);
    }
  }, [isCacheValid, fetchUserProfile, sessionChecking]);

  // Activity tracking with throttling
  useEffect(() => {
    let throttleTimer;
    
    const updateActivity = () => {
      if (throttleTimer) return;
      
      throttleTimer = setTimeout(() => {
        setLastActivity(Date.now());
        throttleTimer = null;
      }, 1000); // Throttle to once per second
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));
    
    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, []);

  // Auto logout with improved logic
  useEffect(() => {
    if (!currentUser) return;

    const checkInactivity = () => {
      const inactive = Date.now() - lastActivity;
      const oneHour = 60 * 60 * 1000;
      
      if (inactive > oneHour) {
        handleLogout();
        alert("You have been logged out due to inactivity.");
      }
    };

    const interval = setInterval(checkInactivity, 10 * 60 * 1000); // Check every 10 minutes
    return () => clearInterval(interval);
  }, [currentUser, lastActivity, handleLogout]);

  // Page visibility handling for session refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUser) {
        // Check session when page becomes visible again
        checkSession(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser, checkSession]);

  // Initialize auth
  useEffect(() => {
    let mounted = true;
    let subscription;

    const initializeAuth = async () => {
      try {
        await checkSession();

        // Set up auth listener
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          console.log('Auth state change:', event);
          
          switch (event) {
            case 'SIGNED_IN':
              if (session?.user) {
                await fetchUserProfile(session.user);
              }
              break;
              
            case 'SIGNED_OUT':
              sessionCache.isValid = false;
              sessionCache.user = null;
              sessionCache.profile = null;
              setCurrentUser(null);
              break;
              
            case 'TOKEN_REFRESHED':
              if (session?.user) {
                // Update cache timestamp on token refresh
                sessionCache.lastFetch = Date.now();
                if (!currentUser || currentUser.id !== session.user.id) {
                  await fetchUserProfile(session.user);
                }
              }
              break;
          }
          
          setLastActivity(Date.now());
        });

        subscription = data.subscription;
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []); // Only run once

  const refreshUserData = useCallback(async () => {
    if (currentUser) {
      await fetchUserProfile({ ...currentUser }, true); // Force refresh
    }
  }, [currentUser, fetchUserProfile]);

  // Memoized routes to prevent unnecessary re-renders
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
          {/* Redirect any unknown routes to dashboard for authenticated users */}
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
          <p className="mt-4 text-slate-600 font-medium">Loading TaskFlow...</p>
        </div>
      </div>
    );
  }

  return <Router>{routes}</Router>;
}