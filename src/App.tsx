/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth/AuthContext";
import { Layout } from "./components/Layout";
import { MyClasses } from "./pages/MyClasses";
import { CreateClass } from "./pages/CreateClass";
import { ClassOverview } from "./pages/ClassOverview";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { StudentManagement } from "./pages/StudentManagement";
import { ClassSettings } from "./pages/ClassSettings";
import { StudentView } from "./pages/StudentView";
import { Projector } from "./pages/Projector";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { TeacherProtectedRoute } from "./components/auth/TeacherProtectedRoute";
import { StudentProtectedRoute } from "./components/auth/StudentProtectedRoute";
import { StudentJoin } from "./pages/StudentJoin";
import { StudentDashboard } from "./pages/StudentDashboard";

const RootRedirect = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mission-bg flex items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-radar-green mb-6"></div>
      </div>
    );
  }

  // Determine if it's an anonymous student session or a teacher
  if (session) {
    if (session.user?.is_anonymous) {
      return <Navigate to="/student/dashboard" replace />;
    }
    return <Navigate to="/teacher/classes" replace />;
  }

  // For unauthenticated users or users relying on mock localStorage, check if they have a student session
  if (localStorage.getItem("gytama_student_id")) {
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

import { MeetingHistory } from "./pages/MeetingHistory";
import { MeetingReport } from "./pages/MeetingReport";

const configuredBase = import.meta.env.BASE_URL;
const routerBasename = window.location.pathname.startsWith(configuredBase)
  ? configuredBase
  : "/";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join" element={<StudentJoin />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/teacher" element={<RootRedirect />} />
          <Route path="/student" element={<RootRedirect />} />

          {/* Student Protected Routes */}
          <Route element={<StudentProtectedRoute />}>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
          </Route>

          {/* Teacher Protected Routes */}
          <Route element={<TeacherProtectedRoute />}>
            <Route path="/projector/:classId" element={<Projector />} />
            <Route path="/projector" element={<RootRedirect />} />

            <Route element={<Layout />}>
              <Route path="/teacher/classes" element={<MyClasses />} />
              <Route path="/teacher/classes/new" element={<CreateClass />} />
              <Route
                path="/teacher/classes/:classId"
                element={<ClassOverview />}
              />
              <Route
                path="/teacher/classes/:classId/live"
                element={<TeacherDashboard />}
              />
              <Route
                path="/teacher/classes/:classId/students"
                element={<StudentManagement />}
              />
              <Route
                path="/teacher/classes/:classId/history"
                element={<MeetingHistory />}
              />
              <Route
                path="/teacher/classes/:classId/history/:meetingId"
                element={<MeetingReport />}
              />
              <Route
                path="/teacher/classes/:classId/settings"
                element={<ClassSettings />}
              />
              <Route path="/student/:studentId" element={<StudentView />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
