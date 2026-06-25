import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { AuthShell, Button } from "../../components/ui";

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
    <AuthShell
      eyebrow="INSTRUCTOR REGISTRATION"
      title="Create Teacher Access"
      subtitle="Create your account to begin managing your classes."
    >
      {error && (
        <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/30 rounded-xl text-mission-danger text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div className="text-center space-y-4">
          <div className="p-4 bg-radar-green/10 border border-radar-green/30 rounded-xl text-radar-green text-sm">
            Registration successful! You can now log in. (If email
            confirmation is enabled, please check your inbox).
          </div>
          <Button
            onClick={() => navigate("/login")}
            variant="primary"
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500 py-3 font-bold"
          >
            Go to Login
          </Button>
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
              className="w-full bg-mission-bg border border-mission-border/50 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-mission-bg border border-mission-border/50 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
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
              className="w-full bg-mission-bg border border-mission-border/50 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            variant="primary"
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500 py-3 mt-2 font-bold"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
            ) : (
              "Register"
            )}
          </Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-mission-secondary-text">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
};

