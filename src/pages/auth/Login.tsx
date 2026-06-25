import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { AuthShell, Button } from "../../components/ui";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { session, signInAsDemo } = useAuth();

  // If already logged in as teacher, redirect
  if (session && !session.user?.is_anonymous) {
    navigate("/teacher/classes", { replace: true });
    return null;
  }

  const isMock = import.meta.env.VITE_DATA_SOURCE !== "supabase";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (isMock) {
      // In mock mode, we require them to click the demo button to show explicit intent.
      // But if they fill out the form, we can just do a mock login too.
      signInAsDemo();
      navigate("/teacher/classes", { replace: true });
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate("/teacher/classes", { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to login");
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    signInAsDemo();
    navigate("/teacher/classes", { replace: true });
  };

  return (
    <AuthShell
      eyebrow="TEACHER ACCESS"
      title="Enter Mission Control"
      subtitle="Sign in to manage your classes and student progress."
    >
      {error && (
        <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/30 rounded-xl text-mission-danger text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label
            className="block text-sm font-medium text-mission-secondary-text mb-1.5"
            htmlFor="email"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-mission-bg border border-mission-border/50 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
            required
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-mission-secondary-text mb-1.5"
            htmlFor="password"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-mission-bg border border-mission-border/50 text-white rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-mission-muted-text hover:text-white transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500 py-3 mt-2 font-bold"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      {isMock && (
        <div className="mt-4">
          <Button
            onClick={handleDemoLogin}
            type="button"
            variant="secondary"
            className="w-full py-3 text-white border-mission-border hover:border-cyan-400/50"
          >
            Continue as Demo Teacher
          </Button>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-mission-secondary-text">
        <Link
          to="/register"
          className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
        >
          Create a teacher account
        </Link>
      </div>
    </AuthShell>
  );
};
