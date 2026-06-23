import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { TeacherProfile } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  teacherProfile: TeacherProfile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use a development-only mock user when Supabase is not configured
  const isMock = import.meta.env.VITE_DATA_SOURCE !== 'supabase';

  useEffect(() => {
    if (isMock) {
      setSession({} as Session);
      setUser({ id: 'mock-teacher-id', email: 'teacher@demo.edu' } as User);
      setTeacherProfile({
        id: 'mock-teacher-id',
        full_name: 'Demo Teacher',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const loadProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('teacher_profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (data) {
          setTeacherProfile(data);
        } else {
          console.error("Profile fetch error:", error);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      }
    };

    // Initialize auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsLoading(true);
        await loadProfile(session.user.id);
        setIsLoading(false);
      } else {
        setTeacherProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isMock]);

  const signOut = async () => {
    if (!isMock && supabase) {
      await supabase.auth.signOut();
    }
    // Note: in mock mode we don't actually sign out, or we could simulate it by setting states to null
    // But typically mock mode stays "logged in"
  };

  return (
    <AuthContext.Provider value={{ session, user, teacherProfile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
