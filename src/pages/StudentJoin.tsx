import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, AlertCircle } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { supabase } from "../lib/supabase/client";
import { AuthShell, Button } from "../components/ui";

export const StudentJoin: React.FC = () => {
  const [classCode, setClassCode] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isSupabaseMode = import.meta.env.VITE_DATA_SOURCE === "supabase";
  const isSupabaseConfigured = isSupabaseMode ? !!supabase : true;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!classCode.trim() || !pin.trim()) {
      setError("Please enter both class code and PIN.");
      return;
    }

    if (import.meta.env.DEV) {
      console.log(
        `Starting join flow in mode: ${import.meta.env.VITE_DATA_SOURCE || "supabase"}`,
      );
    }

    setIsLoading(true);
    try {
      const repo = getRepository();
      // Supabase anonymous session is created/managed in joinClassAsStudent or handled by client automatically?
      // For mock, joinClassAsStudent just sets mock device id.
      // For supabase, we might need to actually signInAnonymously if not logged in.
      // We will handle this in SupabaseClassroomRepository
      const result = await repo.joinClassAsStudent(
        classCode.trim(),
        pin.trim(),
      );

      // Save joined student ID locally for easy routing or just rely on backend auth
      localStorage.setItem("gytama_student_id", result.student_id);

      navigate("/student/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "The class code or PIN is incorrect.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="STUDENT PORTAL"
      title="Join Class"
      subtitle="Enter your class code and personal PIN to begin."
    >
      {!isSupabaseConfigured ? (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-500 text-sm shadow-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>Supabase is not configured for this deployment.</p>
        </div>
      ) : (
        <>
          {!isSupabaseMode && import.meta.env.DEV && (
            <div className="mb-6 p-4 bg-cyan-400/10 border border-cyan-400/20 rounded-xl flex items-start gap-3 text-cyan-400 text-sm shadow-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>Demo mode: Student access works only in this browser.</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/20 rounded-xl flex items-start gap-3 text-mission-danger text-sm shadow-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="classCode"
                className="block text-sm font-medium text-mission-secondary-text"
              >
                Class Code
              </label>
              <input
                id="classCode"
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="e.g. GX7K92"
                className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white placeholder:text-mission-muted-text focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none uppercase font-mono tracking-widest text-lg shadow-sm"
                required
                maxLength={6}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-mission-secondary-text"
              >
                Personal PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white placeholder:text-mission-muted-text focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none font-mono tracking-widest text-lg shadow-sm"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              variant="primary"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500 py-3.5 mt-4 font-bold flex items-center justify-center gap-2 shadow-md"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  Join Class
                </>
              )}
            </Button>
          </form>
        </>
      )}

      <div className="mt-8 text-center border-t border-mission-border/50 pt-6">
        <p className="text-sm text-mission-muted-text">
          Are you a teacher?{" "}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
            Log in here
          </Link>
        </p>
      </div>
    </AuthShell>
  );
};

