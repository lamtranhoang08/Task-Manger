// src/App.jsx - Optimized Authentication Handling
import React, { useState, useEffect, useCallback } from "react";
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

// Layout with sidebar
function Layout({ currentUser, onLogout, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentPage = () => {
    const path = location.pathname.replace("/", "");
    return path || "dashboard";
  };

  const handlePageChange = (pageId) => {
    navigate(`/${pageId}`);
  };

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
}

// Email confirmation handler component
function EmailConfirmationHandler() {
  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const handleEmailConfirmation = async () => {
      try {
        // Check URL parameters for tokens
        const urlParams = new URLSearchParams(location.search);
        const fragment = new URLSearchParams(location.hash.substring(1));
        
        // Check both search params and hash fragment for tokens
        const accessToken = urlParams.get('access_token') || fragment.get('access_token');
        const refreshToken = urlParams.get('refresh_token') || fragment.get('refresh_token');
        const type = urlParams.get('type') || fragment.get('type');
        
        if (!accessToken || type !== 'signup') {
          throw new Error('Invalid confirmation link');
        }

        // Set the session using the tokens
        const { data: { session }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (sessionError) {
          throw sessionError;
        }

        if (session?.user && isMounted) {
          // Ensure profile exists
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!profile) {
            await supabase
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                  email: session.user.email,
                  created_at: new Date().toISOString(),
                }
              ]);
          }

          // Success - redirect to dashboard
          navigate('/dashboard', { replace: true });
        } else {
          throw new Error('Failed to establish session');
        }
      } catch (error) {
        console.error('Email confirmation error:', error);
        
        if (isMounted) {
          setError(error.message);
          
          // Redirect after showing error
          setTimeout(() => {
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
        if (isMounted) {
          setConfirming(false);
        }
      }
    };

    const timeoutId = setTimeout(handleEmailConfirmation, 500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoize the profile fetching function
  const fetchUserProfile = useCallback(async (user) => {
    try {
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

      setCurrentUser({
        id: user.id,
        email: user.email,
        name: userName,
        avatar: profileData?.avatar_url || null,
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      // Fallback user object
      setCurrentUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatar: null,
      });
    }
  }, []);

  // Optimized logout function
  const handleLogout = useCallback(async () => {
    try {
      // Clear user state immediately for better UX
      setCurrentUser(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
        // Even if logout fails, keep user state cleared
      }
      
      // Clear any cached data
      localStorage.clear();
      sessionStorage.clear();
      
    } catch (err) {
      console.error("Logout failed:", err);
      // Ensure user is still logged out locally even if server call fails
      setCurrentUser(null);
    }
  }, []);

  // User activity tracking
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));
    
    return () => events.forEach((e) => window.removeEventListener(e, updateActivity));
  }, []);

  // Auto logout after inactivity
  useEffect(() => {
    if (!currentUser) return;

    const checkInactivity = () => {
      if (Date.now() - lastActivity > 60 * 60 * 1000) { // 1 hour
        handleLogout();
        alert("You have been logged out due to inactivity.");
      }
    };

    const interval = setInterval(checkInactivity, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [currentUser, lastActivity, handleLogout]);

  // Initialize auth and listen for changes
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
        }
        
        if (session?.user && mounted) {
          await fetchUserProfile(session.user);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || !isInitialized) return;
        
        console.log('Auth state change:', event, session?.user?.email || 'no user');
        
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              await fetchUserProfile(session.user);
            }
            break;
            
          case 'SIGNED_OUT':
            setCurrentUser(null);
            break;
            
          case 'TOKEN_REFRESHED':
            // Only update if user changed or we don't have user data
            if (session?.user && (!currentUser || currentUser.id !== session.user.id)) {
              await fetchUserProfile(session.user);
            }
            break;
            
          default:
            // Handle other events if needed
            break;
        }
        
        setLastActivity(Date.now());
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [isInitialized, fetchUserProfile, currentUser]);

  const refreshUserData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user);
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  }, [fetchUserProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-slate-600 font-medium">Loading TaskFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
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
        
        {/* Email confirmation route */}
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
                  <DashboardPage currentUser={currentUser} />
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
              path="/workspace"
              element={
                <Layout currentUser={currentUser} onLogout={handleLogout}>
                  <WorkspacePage currentUser={currentUser} />
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
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </Router>
  );
}