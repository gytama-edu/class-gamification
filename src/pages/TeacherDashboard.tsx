import React, { useState, useEffect } from "react";
import {
  Play,
  Power,
  Settings2,
  Users,
  Trophy,
  ExternalLink,
} from "lucide-react";
import { useAppContext } from "../store";
import { StudentTable } from "../components/StudentTable";
import { NewMeetingDialog } from "../components/NewMeetingDialog";
import { EndMeetingDialog } from "../components/EndMeetingDialog";
import { Link, useParams } from "react-router-dom";

export const TeacherDashboard: React.FC = () => {
  const { classId } = useParams();
  const {
    dashboardData,
    isLoadingDashboard,
    error,
    updateMaxLives,
    startNewMeeting,
    endMeeting,
  } = useAppContext();
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const [isEndMeetingDialogOpen, setIsEndMeetingDialogOpen] = useState(false);

  if (isLoadingDashboard || !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-radar-green mb-4"></div>
        <p className="text-mission-secondary-text font-medium tracking-wide">
          Loading Classroom Data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-mission-danger/10 border border-mission-danger/20 rounded-2xl p-6 text-center max-w-2xl mx-auto mt-10">
        <h2 className="text-xl font-bold text-mission-danger mb-2">
          Connection Error
        </h2>
        <p className="text-mission-primary-text mb-4">{error}</p>
        <p className="text-sm text-mission-muted-text">
          If you are using Supabase, ensure your .env variables are set
          correctly and you have run the database migrations and seed script.
        </p>
      </div>
    );
  }

  const { classroom, students, activeMeeting } = dashboardData;

  if (!activeMeeting) {
    return (
      <div className="bg-mission-panel p-10 rounded-2xl border border-mission-border text-center max-w-2xl mx-auto mt-10">
        <h2 className="text-2xl font-bold text-white mb-2">
          No active meeting
        </h2>
        <p className="text-mission-secondary-text mb-6">
          There is no active meeting for this class. Start a new meeting from
          the overview page.
        </p>
        <Link
          to={`/teacher/classes/${classId}`}
          className="inline-flex items-center justify-center px-6 py-3 bg-mission-panel-elevated text-white rounded-lg hover:bg-mission-bg border border-mission-border transition-colors font-medium"
        >
          Return to Overview
        </Link>
      </div>
    );
  }

  const totalClassPoints = students.reduce((acc, s) => acc + s.total_points, 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300 relative">
      {/* Sticky Meeting Control Bar */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-4 mb-6 bg-mission-bg-secondary/90 backdrop-blur-md border-b border-mission-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-1">
            {classroom.name}
          </h1>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs text-radar-green font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-radar-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-radar-green"></span>
              </span>
              Meeting Live
            </span>
            <span className="text-mission-muted-text text-xs">•</span>
            <span className="text-mission-secondary-text font-medium text-xs">
              Meeting #{classroom.current_meeting_number}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/projector/${classId}`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 bg-mission-panel-elevated text-mission-secondary-text hover:text-white hover:bg-mission-bg rounded-lg border border-mission-border transition-colors font-medium text-sm"
          >
            <ExternalLink size={16} />
            Projector
          </Link>

          <button
            onClick={() => setIsEndMeetingDialogOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-mission-danger/10 text-mission-danger border border-mission-danger/30 rounded-lg hover:bg-mission-danger/20 transition-colors font-bold text-sm shadow-[0_0_15px_rgba(255,87,87,0.1)] focus:outline-none focus:ring-2 focus:ring-mission-danger focus:ring-offset-2 focus:ring-offset-mission-bg-secondary"
          >
            <Power size={18} />
            End Meeting
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-mission-panel p-5 rounded-2xl border border-mission-border flex items-center gap-4 relative overflow-hidden">
          <div className="bg-mission-panel-elevated p-3 rounded-xl border border-mission-border">
            <Users size={24} className="text-mission-primary-text" />
          </div>
          <div>
            <p className="text-sm text-mission-muted-text font-medium">Total Students</p>
            <p className="text-2xl font-bold text-white">{students.length}</p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-radar-green/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-mission-panel p-5 rounded-2xl border border-mission-border flex items-center gap-4 relative overflow-hidden">
          <div className="bg-radar-green/10 p-3 rounded-xl border border-radar-green/20">
            <Trophy size={24} className="text-radar-green" />
          </div>
          <div>
            <p className="text-sm text-mission-muted-text font-medium">Class Points</p>
            <p className="text-2xl font-bold text-white font-mono">
              {totalClassPoints.toLocaleString()}
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-radar-green/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-mission-panel p-5 rounded-2xl border border-mission-border flex items-center justify-between gap-4 relative overflow-hidden sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-4">
            <div className="bg-mission-danger/10 p-3 rounded-xl border border-mission-danger/20">
              <Settings2 size={24} className="text-mission-danger" />
            </div>
            <div>
              <p className="text-sm text-mission-muted-text font-medium">Max Lives</p>
              <p className="text-2xl font-bold text-white">
                {classroom.max_lives}
              </p>
            </div>
          </div>

          <div className="flex flex-col">
            <input
              type="number"
              min="1"
              max="20"
              value={classroom.max_lives}
              onChange={(e) =>
                updateMaxLives(classId!, parseInt(e.target.value) || 1)
              }
              className="w-16 bg-mission-input border border-mission-border rounded-lg px-2 py-1 text-center text-white focus:outline-none focus:border-radar-green transition-colors"
            />
            <span className="text-[10px] text-mission-muted-text mt-1 text-center">
              Limit: 1-20
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div>
        <div className="flex items-center justify-between mb-4 mt-8">
          <h2 className="font-display text-lg font-semibold text-white">Student Roster</h2>
        </div>
        <div className="bg-mission-panel rounded-2xl border border-mission-border overflow-hidden">
           <StudentTable />
        </div>
      </div>

      <EndMeetingDialog
        isOpen={isEndMeetingDialogOpen}
        onClose={() => setIsEndMeetingDialogOpen(false)}
        onConfirm={() => endMeeting(classId!)}
      />
    </div>
  );
};
