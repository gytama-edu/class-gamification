import React, { useState } from 'react';
import { Play, Settings2, Users, Trophy, ExternalLink, RotateCcw } from 'lucide-react';
import { useAppContext } from '../store';
import { StudentTable } from '../components/StudentTable';
import { NewMeetingDialog } from '../components/NewMeetingDialog';
import { Link, useParams } from 'react-router-dom';

export const TeacherDashboard: React.FC = () => {
  const { classId } = useParams();
  const { dashboardData, isLoadingDashboard, error, updateMaxLives, startNewMeeting, restoreDefaultData } = useAppContext();
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);

  if (isLoadingDashboard || !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cosmic-cyan mb-4"></div>
        <p className="text-slate-400 font-medium tracking-wide">Loading Classroom Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-center max-w-2xl mx-auto mt-10">
        <h2 className="text-xl font-bold text-rose-400 mb-2">Connection Error</h2>
        <p className="text-slate-300 mb-4">{error}</p>
        <p className="text-sm text-slate-500">
          If you are using Supabase, ensure your .env variables are set correctly and you have run the database migrations and seed script.
        </p>
      </div>
    );
  }

  const { classroom, students } = dashboardData;
  const totalClassPoints = students.reduce((acc, s) => acc + s.total_points, 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
            {classroom.name}
          </h1>
          <p className="text-slate-400 font-medium flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-cosmic-purple/20 text-cosmic-purple border border-cosmic-purple/30">
              {classroom.level_name}
            </span>
            Meeting #{classroom.current_meeting_number}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link 
            to={`/projector/${classId}`} 
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:border-slate-600 transition-colors font-medium text-sm"
          >
            <ExternalLink size={18} />
            Projector Mode
          </Link>
          <button 
            onClick={() => setIsMeetingDialogOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cosmic-cyan to-blue-500 text-slate-900 rounded-lg shadow-lg shadow-cosmic-cyan/20 hover:opacity-90 transition-opacity font-bold text-sm"
          >
            <Play size={18} className="fill-slate-900" />
            Start New Meeting
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-cosmic-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4 relative overflow-hidden">
          <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
            <Users size={24} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Total Students</p>
            <p className="text-2xl font-bold text-white">{students.length}</p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-cosmic-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4 relative overflow-hidden">
          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
            <Trophy size={24} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Class Points</p>
            <p className="text-2xl font-bold text-white font-mono">{totalClassPoints.toLocaleString()}</p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/5 rounded-full blur-xl"></div>
        </div>

        <div className="bg-cosmic-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              <Settings2 size={24} className="text-rose-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Max Lives</p>
              <p className="text-2xl font-bold text-white">{classroom.max_lives}</p>
            </div>
          </div>
          
          <div className="flex flex-col">
            <input 
              type="number" 
              min="1" 
              max="20" 
              value={classroom.max_lives}
              onChange={(e) => updateMaxLives(classId!, parseInt(e.target.value) || 1)}
              className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center text-white focus:outline-none focus:border-cosmic-cyan transition-colors"
            />
            <span className="text-[10px] text-slate-500 mt-1 text-center">Limit: 1-20</span>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Student Roster</h2>
        </div>
        <StudentTable />
      </div>

      <NewMeetingDialog 
        isOpen={isMeetingDialogOpen} 
        onClose={() => setIsMeetingDialogOpen(false)} 
        onConfirm={() => startNewMeeting(classId!)}
      />
    </div>
  );
};
