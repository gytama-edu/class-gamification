import React from "react";
import { Navigate, Outlet } from "react-router-dom";

export const StudentProtectedRoute: React.FC = () => {
  const studentId = localStorage.getItem("gytama_student_id");

  if (!studentId) {
    return <Navigate to="/join" replace />;
  }

  return <Outlet />;
};
