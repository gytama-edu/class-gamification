/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store';
import { AuthProvider, useAuth } from './lib/auth/AuthContext';
import { Layout } from './components/Layout';
import { MyClasses } from './pages/MyClasses';
import { CreateClass } from './pages/CreateClass';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { StudentManagement } from './pages/StudentManagement';
import { ClassSettings } from './pages/ClassSettings';
import { StudentView } from './pages/StudentView';
import { Projector } from './pages/Projector';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

const RootRedirect = () => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cosmic-navy flex items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cosmic-cyan mb-6"></div>
      </div>
    );
  }
  
  return session ? <Navigate to="/teacher/classes" replace /> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/teacher" element={<RootRedirect />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/projector/:classId" element={<Projector />} />
              <Route path="/projector" element={<RootRedirect />} />

              <Route element={<Layout />}>
                <Route path="/teacher/classes" element={<MyClasses />} />
                <Route path="/teacher/classes/new" element={<CreateClass />} />
                <Route path="/teacher/classes/:classId" element={<TeacherDashboard />} />
                <Route path="/teacher/classes/:classId/students" element={<StudentManagement />} />
                <Route path="/teacher/classes/:classId/settings" element={<ClassSettings />} />
                <Route path="/student/:studentId" element={<StudentView />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
