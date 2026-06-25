import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { History, Calendar, Clock, Users, ArrowRight, ArrowLeft, Search, RefreshCw, X } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { MeetingHistoryItem } from "../lib/types/database";
import { PageHeader, Panel, Button, EmptyState, LoadingSkeleton } from "../components/ui";

export const MeetingHistory: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [meetings, setMeetings] = useState<MeetingHistoryItem[]>([]);
  const [className, setClassName] = useState<string>("Loading class...");
  const [classLevel, setClassLevel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest">("newest");
  
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
      <div className="max-w-6xl mx-auto space-y-6 py-6 animate-in fade-in duration-500">
        <LoadingSkeleton />
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <EmptyState
          icon={History}
          title="History Unavailable"
          description={error}
          action={{
            label: "Retry",
            onClick: loadData
          }}
          className="border-mission-danger/20 bg-mission-danger/5"
        />
        <div className="mt-8 flex justify-center">
          <Link to={`/teacher/classes/${classId}`}>
            <Button variant="ghost"><ArrowLeft size={16} className="mr-2" /> Back to Class Overview</Button>
          </Link>
        </div>
      </div>
    );
  }

  let filteredMeetings = meetings.filter(m => {
    if (searchTerm && !m.meeting_number.toString().includes(searchTerm)) return false;
    return true;
  });

  filteredMeetings.sort((a, b) => {
    if (sortOrder === "newest") {
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    } else if (sortOrder === "oldest") {
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    } else if (sortOrder === "highest") {
      return b.net_points - a.net_points;
    }
    return 0;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 py-6 px-4 sm:px-0">
      <Link
        to={`/teacher/classes/${classId}`}
        className="inline-flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors mb-2 font-medium"
      >
        <ArrowLeft size={16} />
        Back to Class Overview
      </Link>

      <PageHeader
        eyebrow="SESSION ARCHIVE"
        title="Meeting History"
        subtitle={`${className} ${classLevel ? `• ${classLevel}` : ''}`}
        actions={
          <div className="bg-mission-panel-elevated px-4 py-2.5 rounded-xl border border-mission-border/50 flex items-center gap-3 w-fit shadow-sm">
            <History className="text-cyan-400" size={18} />
            <span className="text-white font-medium">
              {meetings.length} Completed
            </span>
          </div>
        }
      />

      {meetings.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-muted-text" size={18} />
            <input
              type="text"
              placeholder="Search by meeting number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-mission-bg-secondary border border-mission-border/50 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
             <Button
               variant={sortOrder === "newest" ? "primary" : "secondary"}
               onClick={() => setSortOrder("newest")}
               className={sortOrder === "newest" ? "bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500" : "whitespace-nowrap"}
             >
               Newest First
             </Button>
             <Button
               variant={sortOrder === "oldest" ? "primary" : "secondary"}
               onClick={() => setSortOrder("oldest")}
               className={sortOrder === "oldest" ? "bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500" : "whitespace-nowrap"}
             >
               Oldest First
             </Button>
             <Button
               variant={sortOrder === "highest" ? "primary" : "secondary"}
               onClick={() => setSortOrder("highest")}
               className={sortOrder === "highest" ? "bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500" : "whitespace-nowrap"}
             >
               Highest Points
             </Button>
          </div>
        </div>
      )}

      {filteredMeetings.length === 0 ? (
        <EmptyState
          icon={History}
          title="No completed meetings"
          description={meetings.length === 0 
            ? "End your first meeting to generate a report."
            : "Try adjusting your search to find what you're looking for."}
        />
      ) : (
        <div className="grid gap-4">
          {filteredMeetings.map((meeting) => {
            const startDate = meeting.started_at ? new Date(meeting.started_at) : null;
            const endDate = meeting.ended_at ? new Date(meeting.ended_at) : null;
            
            const isInvalidDate = (d: Date | null) => !d || isNaN(d.getTime());
            
            const dateStr = !isInvalidDate(startDate) ? startDate!.toLocaleDateString() : 'Unavailable';
            const startTimeStr = !isInvalidDate(startDate) ? startDate!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unavailable';
            const endTimeStr = !isInvalidDate(endDate) ? endDate!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing';
            
            const durationMins = (!isInvalidDate(startDate) && !isInvalidDate(endDate))
              ? Math.round((endDate!.getTime() - startDate!.getTime()) / 60000)
              : null;

            return (
              <Panel key={meeting.id} className="p-0 border-mission-border/50 hover:border-cyan-400/50 transition-colors overflow-hidden group">
                <div className="flex flex-col md:flex-row md:items-stretch">
                  
                  {/* Left Column: Identify */}
                  <div className="p-5 md:p-6 flex items-start md:items-center gap-5 flex-1 border-b md:border-b-0 md:border-r border-mission-border/50 relative">
                     <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 opacity-80" />
                     <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-mission-panel-strong border border-mission-border/50 flex-shrink-0 shadow-sm">
                       <div className="text-center">
                         <div className="text-[10px] font-bold text-mission-muted-text uppercase tracking-wider mb-0.5">Mtg</div>
                         <div className="text-lg font-mono font-bold text-cyan-400 leading-none">#{meeting.meeting_number}</div>
                       </div>
                     </div>
                     
                     <div>
                       <div className="flex items-center gap-3 mb-1.5">
                         <h3 className="font-display font-bold text-lg text-white">Meeting Report</h3>
                         <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-mission-bg border border-mission-border/50 text-mission-secondary-text uppercase tracking-wider">
                           Completed
                         </span>
                       </div>
                       <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mission-secondary-text">
                         <div className="flex items-center gap-1.5">
                           <Calendar size={14} className="text-mission-muted-text" />
                           {dateStr}
                         </div>
                         <div className="flex items-center gap-1.5">
                           <Clock size={14} className="text-mission-muted-text" />
                           {startTimeStr} - {endTimeStr}
                           {durationMins !== null && <span className="ml-1 text-mission-muted-text">({durationMins}m)</span>}
                         </div>
                       </div>
                     </div>
                  </div>
                  
                  {/* Right Column: Stats & Action */}
                  <div className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 md:w-auto bg-mission-panel-elevated/30">
                    <div className="flex items-center gap-5">
                       <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg shrink-0">
                         <Users size={16} className="text-blue-400" />
                         <span className="text-sm font-mono font-bold text-blue-400">{meeting.participant_count}</span>
                       </div>
                       
                       <div className="flex items-center gap-2 px-3 py-1.5 bg-radar-green/10 border border-radar-green/20 rounded-lg shrink-0">
                         <span className="text-xs font-bold text-radar-green uppercase">Pts</span>
                         <span className="text-sm font-mono font-bold text-radar-green">
                           {meeting.net_points > 0 ? '+' : ''}{meeting.net_points}
                         </span>
                       </div>
                    </div>
                    
                    <Link
                      to={`/teacher/classes/${classId}/history/${meeting.id}`}
                    >
                      <Button variant="primary" className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-black border-cyan-500 group-hover:shadow-md transition-all">
                        View Report
                        <ArrowRight size={16} className="ml-2" />
                      </Button>
                    </Link>
                  </div>

                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
};

