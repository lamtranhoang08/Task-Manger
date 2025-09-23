// // src/App.jsx (Fixed)
import React, { useState, useEffect } from "react";
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
      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const fetchUserProfile = async (user) => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      let userName =
        profileData?.name ||
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
      setCurrentUser({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatar: null,
      });
    }
  };

  // User activity tracking
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, updateActivity));
    return () => events.forEach((e) => window.removeEventListener(e, updateActivity));
  }, []);

  // Auto logout after 1 hour inactivity
  useEffect(() => {
    const checkInactivity = () => {
      if (!currentUser) return;
      if (Date.now() - lastActivity > 60 * 60 * 1000) {
        handleLogout();
        alert("You have been logged out due to inactivity.");
      }
    };
    const interval = setInterval(checkInactivity, 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser, lastActivity]);

  // Initialize auth and listen for changes
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          fetchUserProfile(session.user);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (session?.user) fetchUserProfile(session.user);
        else setCurrentUser(null);
        setLastActivity(Date.now());
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const refreshUserData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) fetchUserProfile(session.user);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Logout failed:", err);
    } finally {
      setCurrentUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
        <p className="ml-3 text-gray-600">Loading application...</p>
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
            {/* Only redirect to dashboard for the root path */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </>
        ) : (
          /* Redirect unauthenticated users to login */
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </Router>
  );
}