import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { LogIn, AlertCircle, User, RefreshCw } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { supabase } from "../lib/supabase/client";
import { useStudentAuth } from "../lib/auth/StudentAuthContext";
import { AuthShell, Button } from "../components/ui";

export const StudentJoin: React.FC = () => {
  const [classCode, setClassCode] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { isAuthenticated, session, loading: authLoading, isPersistent, setPersistence, releaseSession, refreshSession } = useStudentAuth();

  const isSupabaseMode = import.meta.env.VITE_DATA_SOURCE === "supabase";
  const isSupabaseConfigured = isSupabaseMode ? !!supabase : true;

  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam) {
      setError(errParam);
    }
  }, [searchParams]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (classCode.trim().length !== 6 || pin.trim().length !== 4) {
      setError("Please enter a 6-character class code and a 4-digit PIN.");
      return;
    }

    setIsLoading(true);
    try {
      const repo = getRepository();
      const result = await repo.joinClassAsStudent(
        classCode.trim().toUpperCase(),
        pin.trim(),
      );

      await refreshSession();
      navigate("/student/dashboard");
    } catch (err: any) {
      console.error(err);
      let errMsg = "The class code or PIN is incorrect.";
      if (err.message) {
        if (err.message.includes('INVALID_CREDENTIALS')) {
          errMsg = "The class code or PIN is incorrect.";
        } else if (err.message.includes('ACCOUNT_LINKED_TO_OTHER_DEVICE') || err.message.includes('SESSION_LINKED_TO_OTHER_STUDENT')) {
          errMsg = "This student is already signed in on another device. Ask your teacher to reset device access.";
        } else if (err.message.includes('CLASS_ACCESS_DISABLED') || err.message.includes('STUDENT_ACCESS_DISABLED')) {
          errMsg = "Student access is currently disabled for this class.";
        } else if (err.message.includes('RATE_LIMITED')) {
          errMsg = "Too many attempts. Please wait before trying again.";
        } else {
          errMsg = "Could not connect to the student portal. Check your connection and try again.";
        }
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchStudent = async () => {
    setIsLoading(true);
    await releaseSession();
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-deep-space flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-radar-green mb-6"></div>
      </div>
    );
  }

  // Continue Screen
  if (isAuthenticated && session) {
    return (
      <AuthShell
        eyebrow="STUDENT PORTAL"
        title={`Welcome back, ${session.display_name}`}
        subtitle={session.class_name}
      >
        <div className="space-y-4">
          <Button
            onClick={() => navigate("/student/dashboard")}
            disabled={isLoading}
            variant="primary"
            className="w-full bg-radar-green hover:bg-radar-green/90 text-black border-radar-green py-3.5 font-bold flex items-center justify-center gap-2 shadow-md"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Continue to Dashboard
              </>
            )}
          </Button>

          <Button
            onClick={handleSwitchStudent}
            disabled={isLoading}
            variant="secondary"
            className="w-full py-3.5 flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            Switch Student
          </Button>
        </div>
      </AuthShell>
    );
  }

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
                onChange={(e) => setClassCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
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
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="••••"
                className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white placeholder:text-mission-muted-text focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none font-mono tracking-widest text-lg shadow-sm"
                required
                maxLength={4}
              />
            </div>

            <div className="pt-2 pb-1">
              <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={isPersistent}
                  onChange={(e) => setPersistence(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-deep-space text-radar-green focus:ring-radar-green"
                />
                Keep me signed in on this device
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading || classCode.length !== 6 || pin.length !== 4}
              variant="primary"
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500 py-3.5 mt-4 font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
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

