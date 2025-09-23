import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      if (data?.user) {
        console.log("Login successful:", data.user);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || "Google login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100">
      <div className="max-w-md w-full p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl transition-all">
        <div className="text-center">
          <CheckCircleIcon className="mx-auto h-16 w-16 text-blue-500 mb-4" />
          <h2 className="text-3xl font-extrabold text-white">Taskify</h2>
          <p className="mt-2 text-sm text-gray-400">
            Log in to manage your tasks efficiently.
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

          <div>
            <label
              htmlFor="email"
              className="sr-only"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="Email address"
              className="input-field-dark transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="sr-only"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Password"
              className="input-field-dark transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link
              to="/forgot-password"
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="flex items-center space-x-2">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="text-sm text-gray-500">or</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center p-3 text-sm font-medium border border-gray-700 rounded-lg shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className="w-5 h-5 mr-3"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12.0003 4.75001C14.1483 4.75001 15.9393 5.48001 17.3823 6.84001L20.4443 3.75001C18.4903 1.94001 15.8973 1 12.0003 1C8.24331 1 4.88731 2.22751 2.50031 4.19351L5.91831 6.88501C6.91831 5.92201 8.35631 5.37801 12.0003 5.37801V4.75001Z" fill="#EA4335" />
            <path d="M2.50031 4.1935L1.44231 6.3685C0.844312 7.5765 0.500313 8.84751 0.500313 10.1585C0.500313 11.4695 0.844312 12.7405 1.44231 13.9485L2.50031 16.1235L5.91831 13.432C5.66631 12.781 5.51331 12.0195 5.51331 11.2505C5.51331 10.4815 5.66631 9.72001 5.91831 9.06901L2.50031 4.1935Z" fill="#FBBC05" />
            <path d="M12.0003 23C15.8973 23 18.9903 21.94 20.9343 19.95L17.3823 17.159C15.9393 18.52 14.1483 19.25 12.0003 19.25C8.35631 19.25 6.91831 18.6055 5.91831 17.643L2.50031 20.3345C4.88731 22.3005 8.24331 23.528 12.0003 23.528V23Z" fill="#34A853" />
            <path d="M20.4443 3.75001L20.9443 3.25001L23.5003 5.43801C23.0183 6.64901 22.2593 7.85901 21.2613 8.78801L17.9253 11.432C18.6673 10.457 19.1233 9.38 19.3453 8.25001H12.0003V4.75001H20.4443V3.75001Z" fill="#4285F4" />
          </svg>
          Sign in with Google
        </button>
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
      </div>
    </div>
  );
}