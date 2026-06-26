import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { studentSupabase, isStudentPersistentLogin, setStudentPersistentLogin } from '../supabase/studentClient';
import { getRepository } from '../data/repository';

interface StudentSessionData {
  student_id: string;
  class_id: string;
  display_name: string;
  class_name: string;
  class_level: number;
  class_type: string;
  access_valid: boolean;
}

interface StudentAuthContextType {
  session: StudentSessionData | null;
  loading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  releaseSession: () => Promise<void>;
  isAuthenticated: boolean;
  isPersistent: boolean;
  setPersistence: (persist: boolean) => void;
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined);

export const StudentAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<StudentSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean>(isStudentPersistentLogin());

  const refreshSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRepository().getMyStudentSession();
      if (data && data.access_valid) {
        setSession(data);
        // Also update the legacy ID for compatibility in realtime
        if (isPersistent) {
          localStorage.setItem('gytama_student_id', data.student_id);
          sessionStorage.removeItem('gytama_student_id');
        } else {
          sessionStorage.setItem('gytama_student_id', data.student_id);
          localStorage.removeItem('gytama_student_id');
        }
      } else {
        setSession(null);
        localStorage.removeItem('gytama_student_id');
        sessionStorage.removeItem('gytama_student_id');
      }
    } catch (err: any) {
      setSession(null);
      setError(err.message || 'Failed to refresh student session');
      localStorage.removeItem('gytama_student_id');
      sessionStorage.removeItem('gytama_student_id');
    } finally {
      setLoading(false);
    }
  }, [isPersistent]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Handle auth state changes
  useEffect(() => {
    if (!studentSupabase) return;
    const { data: { subscription } } = studentSupabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        localStorage.removeItem('gytama_student_id');
        sessionStorage.removeItem('gytama_student_id');
      } else if (event === 'SIGNED_IN') {
        refreshSession();
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshSession]);

  const releaseSession = async () => {
    try {
      setLoading(true);
      await getRepository().releaseMyStudentSession();
      setSession(null);
      localStorage.removeItem('gytama_student_id');
      sessionStorage.removeItem('gytama_student_id');
    } catch (err) {
      console.error("Failed to release session", err);
    } finally {
      setLoading(false);
    }
  };

  const setPersistence = (persist: boolean) => {
    setStudentPersistentLogin(persist);
    setIsPersistent(persist);
    // Move the legacy ID if we have a session
    if (session) {
      if (persist) {
        localStorage.setItem('gytama_student_id', session.student_id);
        sessionStorage.removeItem('gytama_student_id');
      } else {
        sessionStorage.setItem('gytama_student_id', session.student_id);
        localStorage.removeItem('gytama_student_id');
      }
    }
  };

  const value = {
    session,
    loading,
    error,
    refreshSession,
    releaseSession,
    isAuthenticated: !!session,
    isPersistent,
    setPersistence
  };

  return (
    <StudentAuthContext.Provider value={value}>
      {children}
    </StudentAuthContext.Provider>
  );
};

export const useStudentAuth = () => {
  const context = useContext(StudentAuthContext);
  if (context === undefined) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider');
  }
  return context;
};
