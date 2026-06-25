import React, { useState } from "react";
import {
  Play,
  Power,
  Settings2,
  Users,
  Trophy,
  ExternalLink,
  Activity,
  Heart
} from "lucide-react";
import { useAppContext } from "../store";
import { StudentTable } from "../components/StudentTable";
import { EndMeetingDialog } from "../components/EndMeetingDialog";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Panel,
  Button,
  StatusBadge,
  StatCard,
  LoadingSkeleton,
  ErrorState,
  SectionHeader,
  EmptyState
} from "../components/ui";

export const TeacherDashboard: React.FC = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const {
    dashboardData,
    isLoadingDashboard,
    error,
    updateMaxLives,
    endMeeting,
  } = useAppContext();
  const [isEndMeetingDialogOpen, setIsEndMeetingDialogOpen] = useState(false);

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
          title="Live Meeting Unavailable"
          message={error}
          onRetry={() => navigate(`/teacher/classes/${classId}`)}
          className="max-w-lg w-full"
        />
      </div>
    );
  }

  const { classroom, students, activeMeeting } = dashboardData;

  if (!activeMeeting) {
    return (
      <div className="mt-12 flex justify-center">
        <EmptyState
          icon={Power}
          title="No Active Meeting"
          description="Start a meeting from the Class Overview before opening live controls."
          action={
            <Button onClick={() => navigate(`/teacher/classes/${classId}`)}>
              Return to Overview
            </Button>
          }
          className="max-w-lg w-full"
        />
      </div>
    );
  }

  const totalClassPoints = students.reduce((acc, s) => acc + (Number.isFinite(Number(s.total_points)) ? Number(s.total_points) : 0), 0);
  const activeStudents = students.filter(s => s.status === 'active');

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200 relative">
      {/* Sticky Meeting Control Bar */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-6 bg-mission-bg/80 backdrop-blur-xl border-b border-mission-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold font-sans text-mission-muted-text uppercase tracking-widest mb-0.5 block">
            LIVE CLASS SESSION
          </span>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              {classroom.name}
            </h1>
            <StatusBadge variant="success" dot>Meeting #{classroom.current_meeting_number}</StatusBadge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(`/projector/${classId}`, "_blank")}
          >
            <ExternalLink size={16} className="mr-2" />
            Projector
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsEndMeetingDialogOpen(true)}
            className="shadow-sm"
          >
            <Power size={16} className="mr-2" />
            End Meeting
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Students" value={activeStudents.length} icon={Users} />
        <StatCard label="Class Points" value={totalClassPoints} valueColor="success" icon={Trophy} />
        
        <Panel className="p-5 flex flex-col justify-between group overflow-hidden relative border-mission-border/50">
          <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 opacity-80" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
              <Heart size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs text-mission-muted-text uppercase tracking-wider font-bold mb-1">
              Max Lives
            </p>
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <input
                  type="number"
                  min="1"
                  max="20"
                  value={classroom.max_lives}
                  onChange={(e) =>
                    updateMaxLives(classId!, parseInt(e.target.value) || 1)
                  }
                  className="w-16 bg-mission-bg-secondary border border-mission-border/50 rounded-lg px-2 py-1 text-center font-mono font-bold text-lg text-white focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
                />
               </div>
               <span className="text-[10px] text-mission-muted-text font-medium bg-mission-panel-strong px-2 py-1 rounded-md">
                Range: 1–20
              </span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Operations Summary Strip */}
      <div className="bg-mission-panel border border-mission-border/50 rounded-xl p-3 flex items-center gap-3">
        <Activity size={16} className="text-mission-secondary-text" />
        <p className="text-sm text-mission-secondary-text">
          Use the controls below to manage points and lives during the meeting.
        </p>
      </div>

      {/* Main Table Area */}
      <Panel className="overflow-hidden p-0 border-mission-border/50">
        <div className="p-5 border-b border-mission-border/50 bg-mission-bg-secondary/50">
          <SectionHeader
            title="Student Control"
            description="Manage live points and session lives."
          />
        </div>
        <StudentTable />
      </Panel>

      <EndMeetingDialog
        isOpen={isEndMeetingDialogOpen}
        onClose={() => setIsEndMeetingDialogOpen(false)}
        onConfirm={() => endMeeting(classId!)}
      />
    </div>
  );
};

