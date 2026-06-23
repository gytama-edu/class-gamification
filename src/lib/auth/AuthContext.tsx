import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { TeacherProfile } from "../types/database";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  teacherProfile: TeacherProfile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  signInAsDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Use a development-only mock user when Supabase is not configured
  const isMock = import.meta.env.VITE_DATA_SOURCE !== "supabase";

  useEffect(() => {
    if (isMock) {
      const mockSession = localStorage.getItem("mock_teacher_session");
      if (mockSession === "true") {
        const mockUser = {
          id: "mock-teacher-id",
          email: "teacher@demo.edu",
          is_anonymous: false,
        } as unknown as User;
        setSession({ user: mockUser } as unknown as Session);
        setUser(mockUser);
        setTeacherProfile({
          id: "mock-teacher-id",
          full_name: "Demo Teacher",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        setSession(null);
        setUser(null);
        setTeacherProfile(null);
      }
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
          .from("teacher_profiles")
          .select("*")
          .eq("id", userId)
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
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user && !session.user.is_anonymous) {
          loadProfile(session.user.id).finally(() => setIsLoading(false));
        } else {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Auth session error:", err);
        setIsLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && !session.user.is_anonymous) {
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
    if (isMock) {
      localStorage.removeItem("mock_teacher_session");
      setSession(null);
      setUser(null);
      setTeacherProfile(null);
      return;
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const signInAsDemo = () => {
    if (isMock) {
      localStorage.setItem("mock_teacher_session", "true");
      const mockUser = {
        id: "mock-teacher-id",
        email: "teacher@demo.edu",
        is_anonymous: false,
      } as unknown as User;
      setSession({ user: mockUser } as unknown as Session);
      setUser(mockUser);
      setTeacherProfile({
        id: "mock-teacher-id",
        full_name: "Demo Teacher",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        teacherProfile,
        isLoading,
        signOut,
        signInAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
