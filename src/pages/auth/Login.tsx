import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import missionControlLogo from "../../assets/branding/mission-control-full.jpeg";

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
    <div className="min-h-screen bg-mission-bg flex items-center justify-center p-4 font-sans text-mission-primary-text relative overflow-hidden">
      {/* Background Radar Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z' fill='%2339FF88' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`, backgroundSize: '20px 20px' }}></div>

      <div className="w-full max-w-md bg-mission-panel border border-mission-border rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-radar-green/5 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative z-10 text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-6">
            <img src={missionControlLogo} alt="Mission Control" className="h-20 w-auto max-w-[80%] object-contain rounded-xl" />
          </div>
          <div className="text-xs font-semibold text-mission-muted-text uppercase tracking-wider mb-2">
            TEACHER ACCESS
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2 text-white">
            Enter Mission Control
          </h1>
          <p className="text-mission-secondary-text text-sm">
            Sign in to manage your classes and student progress.
          </p>
        </div>

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
              className="w-full bg-mission-panel-elevated border border-mission-border text-white rounded-xl px-4 py-3 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
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
                className="w-full bg-mission-panel-elevated border border-mission-border text-white rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3 bg-radar-green text-mission-bg font-bold rounded-xl hover:bg-strong-green transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-bg disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-mission-bg/30 border-t-mission-bg rounded-full animate-spin"></div>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {isMock && (
          <div className="mt-4">
            <button
              onClick={handleDemoLogin}
              type="button"
              className="w-full flex items-center justify-center py-3 bg-mission-panel-elevated text-mission-primary-text font-medium border border-mission-border rounded-xl hover:bg-mission-bg hover:border-radar-green/50 transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-bg"
            >
              Continue as Demo Teacher
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-mission-secondary-text">
          <Link
            to="/register"
            className="text-radar-green hover:underline font-medium transition-colors"
          >
            Create a teacher account
          </Link>
        </div>
      </div>
    </div>
  );
};
