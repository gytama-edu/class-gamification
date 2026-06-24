import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { History, Calendar, Clock, Users, ArrowRight, ArrowLeft, Search, RefreshCw, X } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { MeetingHistoryItem } from "../lib/types/database";

export const MeetingHistory: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [meetings, setMeetings] = useState<MeetingHistoryItem[]>([]);
  const [className, setClassName] = useState<string>("Loading class...");
  const [classLevel, setClassLevel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  
  const loadData = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);
    try {
      const repo = getRepository();
      
      // Load class info independently so if it fails, history can still show
      repo.getClassroomDashboard(classId).then(dash => {
        if (dash && dash.classroom) {
          setClassName(dash.classroom.name);
          setClassLevel(dash.classroom.level_name);
        }
      }).catch(err => {
        console.warn("Failed to load class info for history page", err);
        setClassName("Unknown Class");
      });

      const historyData = await repo.getMeetingHistory(classId);
      setMeetings(historyData);
    } catch (err) {
      console.error(err);
      setError("Failed to load meeting history. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse py-8">
        <div className="h-10 bg-mission-bg-secondary border border-mission-border rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-mission-bg-secondary border border-mission-border rounded w-full"></div>
        <div className="h-32 bg-mission-bg-secondary border border-mission-border rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 px-4 max-w-lg mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-mission-danger/10 text-mission-danger rounded-full flex items-center justify-center mx-auto mb-4 border border-mission-danger/20">
          <History size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Oops, something went wrong</h2>
        <p className="text-mission-secondary-text">{error}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-6 py-2 bg-mission-panel hover:bg-mission-panel-elevated border border-mission-border rounded-lg text-white font-medium transition-colors"
          >
            <RefreshCw size={18} />
            Retry
          </button>
          <Link to={`/teacher/classes/${classId}`} className="text-radar-green hover:underline font-medium">
            Back to Class Overview
          </Link>
        </div>
      </div>
    );
  }

  const filteredMeetings = meetings.filter(m => {
    if (searchTerm && !m.meeting_number.toString().includes(searchTerm)) return false;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/teacher/classes/${classId}`}
              className="text-mission-secondary-text hover:text-white transition-colors p-1"
              title="Back to Class Overview"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              Meeting History
            </h1>
          </div>
          <p className="text-mission-secondary-text pl-9">
            {className} {classLevel && `• ${classLevel}`}
          </p>
        </div>
        <div className="bg-mission-panel-elevated px-4 py-2 rounded-xl border border-mission-border flex items-center gap-3 w-fit">
          <History className="text-radar-green" size={20} />
          <span className="text-mission-primary-text font-medium">
            {meetings.length} Completed
          </span>
        </div>
      </div>

      {meetings.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-muted-text" size={18} />
            <input
              type="text"
              placeholder="Search by meeting number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-mission-input border border-mission-border text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-radar-green transition-colors"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="px-4 py-2 bg-mission-panel hover:bg-mission-panel-elevated text-mission-secondary-text border border-mission-border rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <X size={16} />
              Clear
            </button>
          )}
        </div>
      )}

      {filteredMeetings.length === 0 ? (
        <div className="bg-mission-panel rounded-2xl border border-mission-border p-8 sm:p-12 text-center">
          <div className="bg-mission-bg-secondary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-mission-border">
            <History className="text-mission-muted-text" size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No completed meetings</h2>
          <p className="text-mission-secondary-text">
            {meetings.length === 0 
              ? "End your first meeting to generate a report."
              : "Try adjusting your search to find what you're looking for."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMeetings.map((meeting) => (
            <div key={meeting.id} className="bg-mission-panel rounded-2xl border border-mission-border p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-radar-green/50 transition-colors">
              <div className="flex items-center gap-5">
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-mission-bg-secondary border border-mission-border flex-shrink-0">
                  <div className="text-center">
                    <div className="text-xs font-bold text-mission-muted-text uppercase tracking-wider mb-0.5">Mtg</div>
                    <div className="text-lg font-bold text-radar-green leading-none">#{meeting.meeting_number}</div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="font-bold text-lg text-white">Meeting Report</h3>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-radar-green/10 text-radar-green uppercase tracking-wider">
                      Completed
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mission-secondary-text">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-mission-muted-text" />
                      {new Date(meeting.started_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-mission-muted-text" />
                      {new Date(meeting.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {meeting.ended_at ? new Date(meeting.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                    </div>
                    <div className="flex items-center gap-1.5 text-radar-green">
                      <Users size={14} />
                      {meeting.participant_count} Participants
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between md:justify-end gap-6 pt-4 md:pt-0 border-t md:border-0 border-mission-border mt-2 md:mt-0">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xs font-bold text-mission-muted-text uppercase mb-1">Points</div>
                    <div className={`font-mono font-bold ${meeting.net_points >= 0 ? 'text-radar-green' : 'text-mission-danger'}`}>
                      {meeting.net_points > 0 ? '+' : ''}{meeting.net_points}
                    </div>
                  </div>
                </div>
                
                <Link
                  to={`/teacher/classes/${classId}/history/${meeting.id}`}
                  className="flex items-center gap-2 px-5 py-2.5 bg-mission-bg-secondary hover:bg-radar-green hover:text-mission-bg border border-mission-border hover:border-radar-green rounded-xl text-white font-medium transition-all group"
                >
                  View Report
                  <ArrowRight size={18} className="text-mission-muted-text group-hover:text-mission-bg transition-colors" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
