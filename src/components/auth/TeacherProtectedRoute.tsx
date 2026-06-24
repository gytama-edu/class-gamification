import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";
import { AppProvider } from "../../store";

export const TeacherProtectedRoute: React.FC = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mission-bg flex flex-col items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-radar-green mb-6"></div>
        <p className="text-xl text-mission-secondary-text">Checking authentication...</p>
      </div>
    );
  }

  // Allow only non-anonymous users
  if (!session || session.user?.is_anonymous) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  );
};
