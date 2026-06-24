import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import missionControlLogo from "../../assets/branding/mission-control-full.jpeg";

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();

  if (session && !session.user?.is_anonymous) {
    navigate("/teacher/classes", { replace: true });
    return null;
  }

  const isMock = import.meta.env.VITE_DATA_SOURCE !== "supabase";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    if (isMock) {
      setTimeout(() => {
        setSuccess(true);
        setIsLoading(false);
      }, 500);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Create teacher profile
        const { error: profileError } = await supabase
          .from("teacher_profiles")
          .insert({
            id: data.user.id,
            full_name: fullName,
          });

        if (profileError) {
          console.error("Error creating profile:", profileError);
          // Don't throw here, user is already created, but we should handle it gracefully
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mission-bg flex items-center justify-center p-4 font-sans text-mission-primary-text relative overflow-hidden">
      {/* Background Radar Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z' fill='%2339FF88' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`, backgroundSize: '20px 20px' }}></div>

      <div className="w-full max-w-md bg-mission-panel border border-mission-border rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-radar-green/5 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative z-10 text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-6">
            <img src={missionControlLogo} alt="Mission Control" className="h-20 w-auto max-w-[80%] object-contain rounded-xl" />
          </div>
          <div className="text-xs font-semibold text-mission-muted-text uppercase tracking-wider mb-2">
            INSTRUCTOR REGISTRATION
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2 text-white">
            Create Teacher Access
          </h1>
          <p className="text-mission-secondary-text text-sm">
            Create your account to begin managing your classes.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/30 rounded-xl text-mission-danger text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-strong-green/10 border border-strong-green/30 rounded-xl text-strong-green text-sm">
              Registration successful! You can now log in. (If email
              confirmation is enabled, please check your inbox).
            </div>
            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center justify-center py-3 bg-radar-green text-mission-bg font-bold rounded-xl hover:bg-strong-green transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-bg"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-mission-secondary-text mb-1.5"
                htmlFor="fullName"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-mission-panel-elevated border border-mission-border text-white rounded-xl px-4 py-3 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
                required
              />
            </div>

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
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-mission-panel-elevated border border-mission-border text-white rounded-xl px-4 py-3 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
                required
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-mission-secondary-text mb-1.5"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-mission-panel-elevated border border-mission-border text-white rounded-xl px-4 py-3 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3 mt-2 bg-radar-green hover:bg-strong-green text-mission-bg font-bold rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-bg"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-mission-bg/30 border-t-mission-bg rounded-full animate-spin"></div>
              ) : (
                "Register"
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-mission-secondary-text">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-radar-green hover:text-strong-green hover:underline font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
