import React, { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useStudentAuth } from "../../lib/auth/StudentAuthContext";

export const StudentProtectedRoute: React.FC = () => {
  const { isAuthenticated, loading, error, releaseSession } = useStudentAuth();

  useEffect(() => {
    if (error && isAuthenticated) {
      releaseSession();
    }
  }, [error, isAuthenticated, releaseSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-deep-space flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-radar-green mb-6"></div>
        <p className="text-gray-400 font-mono text-sm">Validating secure channel...</p>
      </div>
    );
  }

  if (error && !isAuthenticated) {
    return <Navigate to={`/join?error=${encodeURIComponent(error)}`} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/join" replace />;
  }

  return <Outlet />;
};
