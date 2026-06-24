import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Rocket, LogIn, AlertCircle } from "lucide-react";
import { getRepository } from "../lib/data/repository";

export const StudentJoin: React.FC = () => {
  const [classCode, setClassCode] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-cosmic-bg text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-[10%] w-2 h-2 rounded-full bg-white opacity-40 shadow-[0_0_10px_2px_rgba(255,255,255,0.8)]" />
        <div className="absolute top-40 right-[20%] w-1 h-1 rounded-full bg-cosmic-cyan opacity-60 shadow-[0_0_8px_1px_rgba(45,212,191,0.8)]" />
        <div className="absolute bottom-20 left-[30%] w-1.5 h-1.5 rounded-full bg-cosmic-purple opacity-50 shadow-[0_0_8px_1px_rgba(168,85,247,0.8)]" />
        <div className="absolute w-[800px] h-[800px] bg-cosmic-purple/10 rounded-full blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="bg-cosmic-panel border border-slate-800 rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cosmic-cyan to-blue-500 flex items-center justify-center shadow-lg shadow-cosmic-cyan/20">
            <Rocket size={32} className="text-slate-900" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Join Your Class
          </h1>
          <p className="text-slate-400">
            Enter your class code and personal PIN to blast off!
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="classCode"
              className="block text-sm font-medium text-slate-300"
            >
              Class Code
            </label>
            <input
              id="classCode"
              type="text"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              placeholder="e.g. GX7K92"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-cosmic-cyan focus:ring-1 focus:ring-cosmic-cyan transition-all outline-none uppercase font-mono tracking-widest text-lg"
              required
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="pin"
              className="block text-sm font-medium text-slate-300"
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
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:border-cosmic-cyan focus:ring-1 focus:ring-cosmic-cyan transition-all outline-none font-mono tracking-widest text-lg"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-cosmic-cyan to-blue-500 text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-cosmic-cyan/20 disabled:opacity-50 mt-4"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                Join Class
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-500">
            Are you a teacher?{" "}
            <Link to="/login" className="text-cosmic-cyan hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
