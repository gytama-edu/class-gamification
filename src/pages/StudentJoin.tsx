import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, AlertCircle } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { supabase } from "../lib/supabase/client";
import missionControlLogo from "../assets/branding/mission-control-full.jpeg";

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
    <div className="min-h-screen bg-mission-bg text-mission-primary-text flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Radar Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z' fill='%2339FF88' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`, backgroundSize: '20px 20px' }}></div>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute w-[800px] h-[800px] bg-radar-green/5 rounded-full blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="bg-mission-panel border border-mission-border rounded-2xl p-8 max-w-md w-full relative z-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-center mb-8">
          <img src={missionControlLogo} alt="Mission Control" className="h-20 w-auto max-w-[80%] object-contain rounded-xl" />
        </div>

        <div className="text-center mb-8">
          <div className="text-xs font-semibold text-mission-muted-text uppercase tracking-wider mb-2">
            STUDENT PORTAL
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-2">
            Join Mission
          </h1>
          <p className="text-mission-secondary-text">
            Enter your class code and personal PIN to begin.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mb-6 p-4 bg-mission-warning/10 border border-mission-warning/20 rounded-xl flex items-start gap-3 text-mission-warning text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>Supabase is not configured for this deployment.</p>
          </div>
        ) : (
          <>
            {!isSupabaseMode && import.meta.env.DEV && (
              <div className="mb-6 p-4 bg-mission-info/10 border border-mission-info/20 rounded-xl flex items-start gap-3 text-mission-info text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>Demo mode: Student access works only in this browser.</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/20 rounded-xl flex items-start gap-3 text-mission-danger text-sm">
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
                  className="w-full bg-mission-panel-elevated border border-mission-border rounded-xl px-4 py-3 text-white placeholder:text-mission-muted-text focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all outline-none uppercase font-mono tracking-widest text-lg"
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
                  className="w-full bg-mission-panel-elevated border border-mission-border rounded-xl px-4 py-3 text-white placeholder:text-mission-muted-text focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all outline-none font-mono tracking-widest text-lg"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-radar-green text-mission-bg rounded-xl font-bold hover:bg-strong-green transition-colors disabled:opacity-50 mt-4 focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-bg"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-mission-bg border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={20} />
                    Join Mission
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 text-center border-t border-mission-border pt-6">
          <p className="text-sm text-mission-muted-text">
            Are you a teacher?{" "}
            <Link to="/login" className="text-radar-green hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
