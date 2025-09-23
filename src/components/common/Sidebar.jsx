// src/components/common/Sidebar.jsx
import React from "react";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  Timer,
  MessageSquare,
  Newspaper,
  LogOut,
  Briefcase,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "workspace", label: "Workspace", icon: Briefcase },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "users", label: "Team", icon: Users },
  { id: "meetings", label: "Meetings", icon: Users },
  { id: "timesheets", label: "Timesheets", icon: Timer },
  { id: "chat", label: "Messages", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: Newspaper },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ activePage, onPageChange, currentUser, onLogout }) {
  // Safe user data extraction
  const userName = currentUser?.name || currentUser?.email?.split("@")[0] || 'User';
  const userEmail = currentUser?.email || 'No email';
  const userAvatar = currentUser?.avatar_url || currentUser?.avatar;
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-center h-16 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-purple-600">
        <h1 className="text-xl font-bold text-white tracking-tight">Task Manager</h1>
      </div>

      {/* User Profile */}
      {currentUser && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center space-x-3">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {userInitial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {userEmail}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <item.icon 
                size={20} 
                className={`mr-3 transition-colors ${
                  isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                }`} 
              />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer with Logout */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
        >
          <LogOut 
            size={20} 
            className="mr-3 text-gray-400 group-hover:text-red-500 transition-colors" 
          />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}