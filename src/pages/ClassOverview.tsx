import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Play,
  Settings2,
  Users,
  Trophy,
  ExternalLink,
  Activity,
  ArrowRight,
  Clock,
  Calendar,
} from "lucide-react";
import { useAppContext } from "../store";
import { getRepository } from "../lib/data/repository";
import { NewMeetingDialog } from "../components/NewMeetingDialog";
import { MeetingHistoryItem } from "../lib/types/database";

export const ClassOverview: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const { dashboardData, isLoadingDashboard, error, startNewMeeting, refreshDashboard } =
    useAppContext();
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const [history, setHistory] = useState<MeetingHistoryItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (classId && !isLoadingDashboard) {
      getRepository().getMeetingHistory(classId).then(setHistory).catch(console.error);
    }
  }, [classId, isLoadingDashboard]);

  if (isLoadingDashboard || !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-radar-green mb-6"></div>
        <p className="text-mission-muted-text animate-pulse">
          Loading class overview...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-mission-danger/10 border border-mission-danger/20 text-mission-danger p-6 rounded-xl flex flex-col items-center text-center max-w-lg mx-auto mt-20">
        <p className="font-semibold mb-2">Error loading class</p>
        <p className="text-sm opacity-80">{error}</p>
        <Link
          to="/teacher/classes"
          className="mt-4 px-4 py-2 bg-mission-panel-elevated hover:bg-mission-bg border border-mission-border text-white rounded-lg transition-colors"
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-mission-panel p-6 rounded-2xl border border-mission-border">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-display text-3xl font-bold text-white tracking-tight">
              {classroom.name}
            </h1>
            <span className="px-3 py-1 bg-mission-panel-elevated text-mission-secondary-text border border-mission-border rounded-full text-xs font-bold uppercase tracking-wider">
              {classroom.level_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeMeeting ? (
              <span className="flex items-center gap-2 text-sm text-radar-green font-bold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-radar-green opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-radar-green"></span>
                </span>
                Meeting #{classroom.current_meeting_number} currently active
              </span>
            ) : (
              <span className="text-sm text-mission-muted-text font-medium">
                No active meeting
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {activeMeeting ? (
            <Link
              to={`/teacher/classes/${classId}/live`}
              className="flex items-center gap-2 px-6 py-3 bg-radar-green text-mission-bg rounded-lg hover:bg-strong-green transition-colors font-bold text-sm focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-panel"
            >
              <Play size={18} className="fill-mission-bg" />
              Resume Meeting
            </Link>
          ) : (
            <button
              onClick={() => setIsMeetingDialogOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-radar-green text-mission-bg rounded-lg hover:bg-strong-green transition-colors font-bold text-sm focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-panel"
            >
              <Play size={18} className="fill-mission-bg" />
              Start New Meeting
            </button>
          )}

          <Link
            to={`/projector/${classId}`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-3 bg-mission-panel-elevated text-mission-secondary-text hover:text-white hover:bg-mission-bg rounded-lg transition-colors font-medium text-sm border border-mission-border"
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
            <div className="bg-mission-panel p-4 rounded-xl border border-mission-border">
              <p className="text-xs text-mission-muted-text font-semibold uppercase tracking-wider mb-1">
                Active Students
              </p>
              <p className="text-2xl font-bold text-white">
                {activeStudents.length}
              </p>
            </div>
            <div className="bg-mission-panel p-4 rounded-xl border border-mission-border">
              <p className="text-xs text-mission-muted-text font-semibold uppercase tracking-wider mb-1">
                Total Points
              </p>
              <p className="text-2xl font-bold text-radar-green">
                {totalClassPoints}
              </p>
            </div>
            <div className="bg-mission-panel p-4 rounded-xl border border-mission-border">
              <p className="text-xs text-mission-muted-text font-semibold uppercase tracking-wider mb-1">
                Max Lives
              </p>
              <p className="text-2xl font-bold text-mission-primary-text">
                {classroom.max_lives}
              </p>
            </div>
            <div className="bg-mission-panel p-4 rounded-xl border border-mission-border">
              <p className="text-xs text-mission-muted-text font-semibold uppercase tracking-wider mb-1">
                Meetings
              </p>
              <p className="text-2xl font-bold text-mission-primary-text">
                {classroom.current_meeting_number}
              </p>
            </div>
          </div>

          {/* Description Panel */}
          <div className="bg-mission-panel p-6 rounded-2xl border border-mission-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">
                Class Description
              </h2>
              <Link
                to={`/teacher/classes/${classId}/settings`}
                className="text-sm text-mission-secondary-text hover:text-white"
              >
                Edit Description
              </Link>
            </div>
            <p className="text-mission-secondary-text leading-relaxed">
              No class description has been added yet.
            </p>
          </div>

          {/* Recent Meeting Summary */}
          <div className="bg-mission-panel p-6 rounded-2xl border border-mission-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg font-bold text-white">Meeting History</h2>
              {history.length > 0 && (
                <span className="px-3 py-1 bg-mission-panel-elevated text-mission-secondary-text rounded-full text-xs font-bold border border-mission-border">
                  {history.length} Completed
                </span>
              )}
            </div>
            
            {history.length === 0 ? (
              <div className="bg-mission-bg-secondary rounded-xl p-6 text-center border border-mission-border border-dashed">
                <Activity className="mx-auto text-mission-muted-text mb-2" size={32} />
                <p className="text-mission-secondary-text font-medium mb-1">
                  No completed meetings yet.
                </p>
                <p className="text-sm text-mission-muted-text">
                  End your first meeting to generate a report.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-mission-bg-secondary rounded-xl p-4 border border-mission-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">Meeting {history[0].meeting_number}</span>
                      <span className="text-xs text-mission-muted-text">Most Recent</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mission-secondary-text">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(history[0].started_at).toLocaleDateString()}
                      </div>
                      {history[0].ended_at && (
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          {Math.round((new Date(history[0].ended_at).getTime() - new Date(history[0].started_at).getTime()) / 60000)} mins
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users size={12} />
                        {history[0].participant_count} Students
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-mission-muted-text uppercase tracking-wider font-semibold mb-1">Net Points</div>
                    <div className={`font-bold ${history[0].net_points > 0 ? 'text-radar-green' : history[0].net_points < 0 ? 'text-mission-danger' : 'text-mission-primary-text'}`}>
                      {history[0].net_points > 0 ? '+' : ''}{history[0].net_points}
                    </div>
                  </div>
                </div>
                
                <Link
                  to={`/teacher/classes/${classId}/history`}
                  className="w-full py-2.5 bg-mission-panel-elevated hover:bg-mission-bg text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 border border-mission-border hover:border-radar-green/30"
                >
                  View Meeting History
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Top Students Preview */}
          <div className="bg-mission-panel rounded-2xl border border-mission-border overflow-hidden">
            <div className="p-5 border-b border-mission-border bg-mission-bg-secondary">
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Trophy size={18} className="text-radar-green" />
                Top Students
              </h2>
            </div>
            <div className="p-2">
              {topStudents.length === 0 ? (
                <div className="p-4 text-center text-mission-muted-text">
                  No students in this class yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {topStudents.map((student, idx) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-mission-panel-elevated transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? "bg-radar-green/20 text-radar-green"
                              : idx === 1
                                ? "bg-mission-secondary-text/20 text-mission-secondary-text"
                                : idx === 2
                                  ? "bg-mission-warning/20 text-mission-warning"
                                  : "bg-mission-panel-elevated text-mission-muted-text"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <span className="font-medium text-mission-primary-text">
                          {student.display_name}
                        </span>
                      </div>
                      <span className="font-bold text-radar-green">
                        {student.total_points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-mission-border">
              <Link
                to={`/teacher/classes/${classId}/students`}
                className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-mission-secondary-text hover:text-white hover:bg-mission-panel-elevated rounded-lg transition-colors"
              >
                <Users size={16} />
                View All Students
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Student Access Panel */}
          <div className="bg-mission-panel rounded-2xl border border-mission-border overflow-hidden mt-6">
            <div className="p-5 border-b border-mission-border bg-mission-bg-secondary">
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                Student Access
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-mission-secondary-text">Class Join Code</span>
                <span className="text-lg font-mono font-bold text-radar-green tracking-wider">
                  {classroom.join_code}
                </span>
              </div>
              <p className="text-xs text-mission-muted-text">
                Students can join using this code and their personal PIN at:
                <br />
                <span className="text-mission-primary-text font-mono mt-1 block">
                  gytama-edu.github.io/class-gamification/join
                </span>
              </p>
              
              <div className="flex gap-2">
                 <button 
                   onClick={() => navigator.clipboard.writeText(classroom.join_code)}
                   className="flex-1 py-2 bg-mission-panel-elevated hover:bg-mission-bg border border-mission-border text-mission-secondary-text rounded-lg text-sm font-medium transition-colors"
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
                   className="flex-1 py-2 bg-mission-panel-elevated hover:bg-mission-bg border border-mission-border text-mission-secondary-text rounded-lg text-sm font-medium transition-colors"
                 >
                   Regenerate
                 </button>
              </div>

              <div className="pt-4 border-t border-mission-border flex items-center justify-between">
                 <span className="text-sm text-mission-secondary-text">Access Enabled</span>
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
                     classroom.student_access_enabled ? 'bg-radar-green' : 'bg-mission-panel-elevated border border-mission-border'
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
