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
  Copy,
  RefreshCw,
  Power
} from "lucide-react";
import { useAppContext } from "../store";
import { getRepository } from "../lib/data/repository";
import { NewMeetingDialog } from "../components/NewMeetingDialog";
import { MeetingHistoryItem } from "../lib/types/database";
import {
  Panel,
  Button,
  StatusBadge,
  StatCard,
  LoadingSkeleton,
  ErrorState,
  SectionHeader,
  IconButton
} from "../components/ui";

export const ClassOverview: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const { dashboardData, isLoadingDashboard, error, startNewMeeting, refreshDashboard } = useAppContext();
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
      <div className="space-y-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 flex justify-center">
        <ErrorState 
          title="Error loading class" 
          message={error} 
          onRetry={() => navigate("/teacher/classes")}
          className="max-w-lg w-full"
        />
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
    }
  };

  return (
    <div className="animate-in fade-in duration-200 space-y-6 pb-12">
      {/* Header Panel */}
      <Panel className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {classroom.name}
              </h1>
              <StatusBadge>{classroom.level_name || "Uncategorized"}</StatusBadge>
            </div>
            
            <div className="flex items-center gap-2">
              {activeMeeting ? (
                <StatusBadge variant="success" dot className="bg-transparent border-transparent px-0">
                  Meeting #{classroom.current_meeting_number} currently active
                </StatusBadge>
              ) : (
                <span className="text-sm text-mission-muted-text font-medium">
                  No active meeting
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {activeMeeting ? (
              <Button onClick={() => navigate(`/teacher/classes/${classId}/live`)}>
                <Play size={18} className="mr-2" />
                Resume Meeting
              </Button>
            ) : (
              <Button onClick={() => setIsMeetingDialogOpen(true)}>
                <Play size={18} className="mr-2" />
                Start New Meeting
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => window.open(`/projector/${classId}`, "_blank")}
            >
              <ExternalLink size={18} className="mr-2" />
              Projector
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Students" value={activeStudents.length} icon={Users} />
            <StatCard label="Total Points" value={totalClassPoints} valueColor="success" icon={Activity} />
            <StatCard label="Max Lives" value={classroom.max_lives} />
            <StatCard label="Meetings" value={classroom.current_meeting_number} />
          </div>

          {/* Description Panel */}
          <Panel className="p-6">
            <SectionHeader 
              title="Class Description" 
              action={
                <Button variant="ghost" size="sm" onClick={() => navigate(`/teacher/classes/${classId}/settings`)}>
                  Edit
                </Button>
              }
              className="mb-4"
            />
            <p className="text-sm text-mission-secondary-text leading-relaxed">
              No class description has been added yet.
            </p>
          </Panel>

          {/* Recent Meeting Summary */}
          <Panel className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display text-lg font-bold text-white">Meeting History</h2>
              {history.length > 0 && (
                <StatusBadge variant="default">{history.length} Completed</StatusBadge>
              )}
            </div>
            
            {history.length === 0 ? (
              <div className="bg-mission-bg-secondary rounded-xl p-8 text-center border border-mission-border border-dashed">
                <Activity className="mx-auto text-mission-muted-text mb-3" size={32} />
                <p className="text-mission-secondary-text font-medium mb-1">
                  No completed meetings yet.
                </p>
                <p className="text-sm text-mission-muted-text">
                  End your first meeting to generate a report.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-mission-bg-secondary rounded-xl p-5 border border-mission-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-white">Meeting {history[0].meeting_number}</span>
                      <StatusBadge variant="default">Most Recent</StatusBadge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mission-secondary-text">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {new Date(history[0].started_at).toLocaleDateString()}
                      </div>
                      {history[0].ended_at && (
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} />
                          {Math.round((new Date(history[0].ended_at).getTime() - new Date(history[0].started_at).getTime()) / 60000)} mins
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Users size={14} />
                        {history[0].participant_count} Students
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 bg-mission-panel px-4 py-2 rounded-lg border border-mission-border">
                    <div className="text-[10px] text-mission-muted-text uppercase tracking-wider font-bold mb-0.5">Net Points</div>
                    <div className={`text-lg font-mono font-bold ${history[0].net_points > 0 ? 'text-radar-green' : history[0].net_points < 0 ? 'text-mission-danger' : 'text-white'}`}>
                      {history[0].net_points > 0 ? '+' : ''}{history[0].net_points}
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => navigate(`/teacher/classes/${classId}/history`)}
                >
                  View Meeting History
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Top Students Preview */}
          <Panel className="overflow-hidden">
            <div className="p-4 border-b border-mission-border/50 bg-mission-bg-secondary">
              <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                <Trophy size={16} className="text-radar-green" />
                Top Students
              </h2>
            </div>
            <div className="p-2">
              {topStudents.length === 0 ? (
                <div className="p-6 text-center text-sm text-mission-muted-text">
                  No students in this class yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {topStudents.map((student, idx) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-mission-panel-elevated transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? "bg-radar-green/10 text-radar-green border border-radar-green/20"
                              : idx === 1
                                ? "bg-mission-secondary-text/10 text-mission-secondary-text border border-mission-secondary-text/20"
                                : idx === 2
                                  ? "bg-mission-warning/10 text-mission-warning border border-mission-warning/20"
                                  : "bg-mission-panel-strong text-mission-muted-text"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <span className="text-sm font-medium text-white group-hover:text-radar-green transition-colors">
                          {student.display_name}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-radar-green text-sm">
                        {student.total_points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-2 border-t border-mission-border/50 bg-mission-bg-secondary">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => navigate(`/teacher/classes/${classId}/students`)}
              >
                View All Students
                <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </div>
          </Panel>

          {/* Student Access Panel */}
          <Panel className="overflow-hidden">
            <div className="p-4 border-b border-mission-border/50 bg-mission-bg-secondary">
              <h2 className="font-display text-base font-bold text-white">
                Student Access
              </h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="bg-mission-panel-strong p-4 rounded-xl border border-mission-border/50 text-center">
                <span className="text-xs text-mission-secondary-text uppercase tracking-wider font-bold block mb-1">Class Code</span>
                <span className="text-2xl font-mono font-bold text-radar-green tracking-widest">
                  {classroom.join_code}
                </span>
              </div>
              
              <div className="flex gap-2">
                 <Button 
                   variant="secondary"
                   size="sm"
                   className="flex-1"
                   onClick={() => navigator.clipboard.writeText(classroom.join_code)}
                 >
                   <Copy size={14} className="mr-2" />
                   Copy
                 </Button>
                 <Button 
                   variant="secondary"
                   size="sm"
                   className="flex-1"
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
                 >
                   <RefreshCw size={14} className="mr-2" />
                   New Code
                 </Button>
              </div>

              <div className="pt-5 border-t border-mission-border/50 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Power size={16} className={classroom.student_access_enabled ? "text-radar-green" : "text-mission-muted-text"} />
                   <span className="text-sm font-medium text-white">Access Enabled</span>
                 </div>
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
                     classroom.student_access_enabled ? 'bg-radar-green' : 'bg-mission-panel-strong border border-mission-border'
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
          </Panel>
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

