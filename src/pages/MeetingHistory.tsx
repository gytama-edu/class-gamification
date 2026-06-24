import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { History, Calendar, Clock, Users, ArrowRight, ArrowLeft, Search, Filter, X } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { MeetingHistoryItem, ClassroomDashboardData } from "../lib/types/database";

export const MeetingHistory: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [meetings, setMeetings] = useState<MeetingHistoryItem[]>([]);
  const [dashboard, setDashboard] = useState<ClassroomDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  useEffect(() => {
    const loadData = async () => {
      if (!classId) return;
      try {
        setIsLoading(true);
        const repo = getRepository();
        const [historyData, dashData] = await Promise.all([
          repo.getMeetingHistory(classId),
          repo.getClassroomDashboard(classId)
        ]);
        setMeetings(historyData);
        setDashboard(dashData);
      } catch (err) {
        console.error(err);
        setError("Failed to load meeting history.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [classId]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse py-8">
        <div className="h-10 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-slate-800 rounded w-full"></div>
        <div className="h-32 bg-slate-800 rounded w-full"></div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="py-8 text-center">
        <div className="text-rose-400 mb-4">{error || "Class not found."}</div>
        <Link to={`/teacher/classes/${classId}`} className="text-cosmic-cyan hover:underline">
          Back to Class Overview
        </Link>
      </div>
    );
  }

  const filteredMeetings = meetings.filter(m => {
    if (searchTerm && !m.meeting_number.toString().includes(searchTerm)) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/teacher/classes/${classId}`}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
              Meeting History
            </h1>
          </div>
          <p className="text-slate-400">
            {dashboard.classroom.name} • {dashboard.classroom.level_name}
          </p>
        </div>
        <div className="bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-3">
          <History className="text-cosmic-purple" size={20} />
          <span className="text-slate-300 font-medium">
            {meetings.length} Completed
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by meeting number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-cosmic-cyan transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-cosmic-cyan transition-colors"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="active">Active</option>
        </select>
        {(searchTerm || statusFilter !== "all") && (
          <button
            onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors flex items-center gap-2"
          >
            <X size={16} />
            Clear
          </button>
        )}
      </div>

      {filteredMeetings.length === 0 ? (
        <div className="bg-cosmic-panel rounded-2xl border border-slate-800 p-12 text-center">
          <div className="bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <History className="text-slate-400" size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No meetings found</h2>
          <p className="text-slate-400">
            {meetings.length === 0 
              ? "End your first meeting to generate a report."
              : "Try adjusting your filters to find what you're looking for."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMeetings.map((meeting) => (
            <div key={meeting.id} className="bg-cosmic-panel rounded-2xl border border-slate-800 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-5">
                <div className="bg-slate-800/50 w-14 h-14 rounded-xl flex items-center justify-center border border-slate-700 shrink-0">
                  <span className="text-xl font-bold text-white">#{meeting.meeting_number}</span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-white">Meeting {meeting.meeting_number}</h3>
                    {meeting.status === 'completed' ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-bold uppercase tracking-wide">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs font-bold uppercase tracking-wide">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {new Date(meeting.started_at).toLocaleDateString()}
                    </div>
                    {meeting.ended_at && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {Math.round((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 60000)} mins
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users size={14} />
                      {meeting.participant_count} Students
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6 self-start md:self-auto w-full md:w-auto">
                <div className="grid grid-cols-2 md:flex items-center gap-4 md:gap-6 flex-1 text-center md:text-left">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Net Points</div>
                    <div className={`font-bold ${meeting.net_points > 0 ? 'text-emerald-400' : meeting.net_points < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {meeting.net_points > 0 ? '+' : ''}{meeting.net_points}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Lives Lost</div>
                    <div className="font-bold text-rose-400">{meeting.lives_lost}</div>
                  </div>
                </div>
                
                <Link
                  to={`/teacher/classes/${classId}/history/${meeting.id}`}
                  className="px-4 py-2 bg-cosmic-cyan hover:bg-cosmic-cyan/90 text-slate-900 font-bold rounded-xl transition-colors shrink-0"
                >
                  View Report
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
