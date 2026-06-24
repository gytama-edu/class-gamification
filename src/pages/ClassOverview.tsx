import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Play,
  Settings2,
  Users,
  Trophy,
  ExternalLink,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useAppContext } from "../store";
import { getRepository } from "../lib/data/repository";
import { NewMeetingDialog } from "../components/NewMeetingDialog";

export const ClassOverview: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const { dashboardData, isLoadingDashboard, error, startNewMeeting, refreshDashboard } =
    useAppContext();
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const navigate = useNavigate();

  if (isLoadingDashboard || !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cosmic-cyan mb-6"></div>
        <p className="text-slate-400 animate-pulse">
          Loading class overview...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-xl flex flex-col items-center text-center max-w-lg mx-auto mt-20">
        <p className="font-semibold mb-2">Error loading class</p>
        <p className="text-sm opacity-80">{error}</p>
        <Link
          to="/teacher/classes"
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          Back to Classes
        </Link>
      </div>
    );
  }

  const { classroom, students, activeMeeting } = dashboardData;
  const activeStudents = students.filter((s) => s.is_active);
  const totalClassPoints = students.reduce((acc, s) => acc + s.total_points, 0);

  // Top 5 students for preview
  const topStudents = [...students]
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 5);

  const handleStartNewMeeting = async () => {
    try {
      if (classId) {
        await startNewMeeting(classId);
        navigate(`/teacher/classes/${classId}/live`);
      }
    } catch (err) {
      console.error(err);
      // Let the dialog handle the error or handle it here
    }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-cosmic-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-display text-3xl font-bold text-white tracking-tight">
              {classroom.name}
            </h1>
            <span className="px-3 py-1 bg-cosmic-purple/10 text-cosmic-purple border border-cosmic-purple/20 rounded-full text-xs font-bold uppercase tracking-wider">
              {classroom.level_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeMeeting ? (
              <span className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                Meeting #{classroom.current_meeting_number} currently active
              </span>
            ) : (
              <span className="text-sm text-slate-400 font-medium">
                No active meeting
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {activeMeeting ? (
            <Link
              to={`/teacher/classes/${classId}/live`}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cosmic-cyan to-blue-500 text-slate-900 rounded-lg shadow-lg shadow-cosmic-cyan/20 hover:opacity-90 transition-opacity font-bold text-sm"
            >
              <Play size={18} className="fill-slate-900" />
              Resume Meeting
            </Link>
          ) : (
            <button
              onClick={() => setIsMeetingDialogOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cosmic-cyan to-blue-500 text-slate-900 rounded-lg shadow-lg shadow-cosmic-cyan/20 hover:opacity-90 transition-opacity font-bold text-sm"
            >
              <Play size={18} className="fill-slate-900" />
              Start New Meeting
            </button>
          )}

          <Link
            to={`/projector/${classId}`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors font-medium text-sm border border-slate-700"
          >
            <ExternalLink size={18} />
            Projector Mode
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-cosmic-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                Active Students
              </p>
              <p className="text-2xl font-bold text-white">
                {activeStudents.length}
              </p>
            </div>
            <div className="bg-cosmic-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                Total Points
              </p>
              <p className="text-2xl font-bold text-amber-400">
                {totalClassPoints}
              </p>
            </div>
            <div className="bg-cosmic-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                Max Lives
              </p>
              <p className="text-2xl font-bold text-rose-400">
                {classroom.max_lives}
              </p>
            </div>
            <div className="bg-cosmic-panel p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                Meetings
              </p>
              <p className="text-2xl font-bold text-cosmic-cyan">
                {classroom.current_meeting_number}
              </p>
            </div>
          </div>

          {/* Description Panel */}
          <div className="bg-cosmic-panel p-6 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">
                Class Description
              </h2>
              <Link
                to={`/teacher/classes/${classId}/settings`}
                className="text-sm text-cosmic-cyan hover:text-cosmic-cyan/80"
              >
                Edit Description
              </Link>
            </div>
            <p className="text-slate-300 leading-relaxed">
              No class description has been added yet.
            </p>
          </div>

          {/* Recent Meeting Summary */}
          <div className="bg-cosmic-panel p-6 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg font-bold text-white">Meeting History</h2>
              <span className="text-sm text-slate-500">Coming soon</span>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-6 text-center border border-slate-800 border-dashed">
              <Activity className="mx-auto text-slate-600 mb-2" size={32} />
              <p className="text-slate-400 font-medium">
                Detailed meeting history will be available soon.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Top Students Preview */}
          <div className="bg-cosmic-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Trophy size={18} className="text-amber-400" />
                Top Students
              </h2>
            </div>
            <div className="p-2">
              {topStudents.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  No students in this class yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {topStudents.map((student, idx) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? "bg-amber-400/20 text-amber-400"
                              : idx === 1
                                ? "bg-slate-300/20 text-slate-300"
                                : idx === 2
                                  ? "bg-amber-700/20 text-amber-600"
                                  : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <span className="font-medium text-slate-200">
                          {student.display_name}
                        </span>
                      </div>
                      <span className="font-bold text-amber-400">
                        {student.total_points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-800">
              <Link
                to={`/teacher/classes/${classId}/students`}
                className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Users size={16} />
                View All Students
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Student Access Panel */}
          <div className="bg-cosmic-panel rounded-2xl border border-slate-800 overflow-hidden mt-6">
            <div className="p-5 border-b border-slate-800 bg-slate-900/50">
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                Student Access
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Class Join Code</span>
                <span className="text-lg font-mono font-bold text-cosmic-cyan tracking-wider">
                  {classroom.join_code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Students can join using this code and their personal PIN at:
                <br />
                <span className="text-slate-300 font-mono mt-1 block">
                  gytama-edu.github.io/class-gamification/join
                </span>
              </p>
              
              <div className="flex gap-2">
                 <button 
                   onClick={() => navigator.clipboard.writeText(classroom.join_code)}
                   className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                 >
                   Copy Code
                 </button>
                 <button 
                   onClick={async () => {
                     if (confirm("The old class code will stop working. Students who have already joined will remain connected.")) {
                       try {
                         const repo = getRepository();
                         await repo.regenerateJoinCode(classroom.id);
                         refreshDashboard();
                       } catch (e) {
                         alert("Failed to regenerate join code.");
                       }
                     }
                   }}
                   className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                 >
                   Regenerate
                 </button>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                 <span className="text-sm text-slate-400">Access Enabled</span>
                 <button
                   onClick={async () => {
                     try {
                       const repo = getRepository();
                       await repo.updateStudentAccessEnabled(classroom.id, !classroom.student_access_enabled);
                       refreshDashboard();
                     } catch (e) {
                       alert("Failed to update access.");
                     }
                   }}
                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                     classroom.student_access_enabled ? 'bg-emerald-500' : 'bg-slate-600'
                   }`}
                 >
                   <span
                     className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                       classroom.student_access_enabled ? 'translate-x-6' : 'translate-x-1'
                     }`}
                   />
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewMeetingDialog
        isOpen={isMeetingDialogOpen}
        hasActiveMeeting={false}
        onClose={() => setIsMeetingDialogOpen(false)}
        onConfirm={handleStartNewMeeting}
      />
    </div>
  );
};
