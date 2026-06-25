import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Trophy, Star, Heart, Activity } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { ClassroomDashboardData } from "../lib/types/database";
import { useClassroomRealtime } from "../lib/realtime/useClassroomRealtime";
import { ClassTypeBadge } from "../components/ClassTypeBadge";

export const Projector: React.FC = () => {
  const { classId } = useParams();
  const [data, setData] = useState<ClassroomDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!classId) return;
    try {
      const repo = getRepository();
      const dashboard = await repo.getClassroomDashboard(classId);
      setData(dashboard);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useClassroomRealtime(
    classId || null,
    data?.activeMeeting?.id || null,
    loadData,
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-mission-bg flex flex-col items-center justify-center font-sans p-8">
        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
        <p className="text-xl text-cyan-400 font-bold tracking-[0.2em] uppercase font-mono">
          Initializing Stream
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-mission-bg flex flex-col items-center justify-center font-sans p-8 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-30"></div>
        <div className="bg-mission-danger/10 border border-mission-danger/20 rounded-3xl p-10 text-center max-w-3xl relative z-10 backdrop-blur-md">
          <Activity className="mx-auto mb-6 text-mission-danger" size={48} />
          <h2 className="text-3xl font-display font-bold text-white mb-2">
            Signal Lost
          </h2>
          <p className="text-lg text-mission-secondary-text">
            {error || "Classroom transmission could not be established."}
          </p>
        </div>
      </div>
    );
  }

  const getSafePoints = (points: any) => Number.isFinite(Number(points)) ? Number(points) : 0;

  // Sort students by points descending
  const sortedStudents = [...data.students].sort(
    (a, b) => getSafePoints(b.total_points) - getSafePoints(a.total_points),
  );
  const topThree = sortedStudents.slice(0, 3);
  const rest = sortedStudents.slice(3);

  return (
    <div className="min-h-screen bg-mission-bg flex flex-col font-sans p-6 xl:p-10 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-20"></div>
      <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[150px] translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between mb-8 xl:mb-12 bg-mission-panel-elevated/40 backdrop-blur-xl border border-mission-border/50 rounded-3xl p-6 xl:p-8 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-mission-bg-secondary border border-mission-border/50 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            <Trophy className="text-cyan-400" size={40} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-4 mb-2">
              <h1 className="text-4xl xl:text-5xl font-display font-bold text-white tracking-tight">
                {data.classroom.name}
              </h1>
              <ClassTypeBadge type={data.classroom.class_type} />
            </div>
            {data.activeMeeting ? (
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
                </span>
                <p className="text-xl xl:text-2xl font-mono text-cyan-400 font-bold tracking-widest uppercase">
                  {data.classroom.level_name} • Mtg #{data.classroom.current_meeting_number}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-mission-muted-text"></div>
                <p className="text-xl xl:text-2xl font-mono text-mission-muted-text font-bold tracking-widest uppercase">
                  Standing By
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-6 bg-mission-bg/50 p-5 rounded-2xl border border-mission-border/50">
           <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2 text-white font-medium text-lg">
               <Star className="text-radar-green fill-radar-green/20" size={20} />
               <span>Points persist</span>
             </div>
             <div className="flex items-center gap-2 text-white font-medium text-lg">
               <Heart className="text-mission-danger fill-mission-danger/20" size={20} />
               <span>Lives reset each class</span>
             </div>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
        
        {/* Top 3 Podium Area */}
        <div className="col-span-1 lg:col-span-5 flex flex-col justify-end min-h-[400px]">
          <div className="flex items-end justify-center gap-4 xl:gap-6 h-full pt-8">
            {/* 2nd Place */}
            {topThree[1] && (
              <div className="w-1/3 flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-100">
                <div className="bg-mission-panel-elevated/80 backdrop-blur-md border border-slate-300/30 rounded-2xl p-4 xl:p-5 w-full mb-4 shadow-xl text-center relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-300 text-mission-bg w-12 h-12 rounded-xl flex items-center justify-center font-bold font-mono text-xl shadow-lg transform rotate-3">
                    2
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold text-white mt-4 truncate px-2">
                    {topThree[1].display_name}
                  </h3>
                  <p className="text-2xl xl:text-3xl font-mono font-bold text-radar-green mt-1">
                    {getSafePoints(topThree[1].total_points).toLocaleString()}
                  </p>
                </div>
                <div className="w-full h-[180px] xl:h-[220px] bg-gradient-to-t from-slate-300/20 to-slate-300/5 rounded-t-xl border-x border-t border-slate-300/20 relative overflow-hidden">
                   <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-10"></div>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <div className="w-1/3 flex flex-col items-center z-10 animate-in slide-in-from-bottom-12 duration-700">
                <div className="bg-mission-panel-elevated backdrop-blur-md border border-amber-400/40 rounded-2xl p-5 xl:p-6 w-full mb-4 shadow-[0_0_30px_rgba(251,191,36,0.15)] text-center relative scale-110">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-400 text-mission-bg w-16 h-16 rounded-xl flex items-center justify-center font-bold font-mono text-3xl shadow-lg transform -rotate-3">
                    1
                  </div>
                  <h3 className="text-xl xl:text-2xl font-bold text-white mt-6 truncate px-2">
                    {topThree[0].display_name}
                  </h3>
                  <p className="text-3xl xl:text-4xl font-mono font-bold text-radar-green mt-1 drop-shadow-[0_0_10px_rgba(57,255,136,0.3)]">
                    {getSafePoints(topThree[0].total_points).toLocaleString()}
                  </p>
                </div>
                <div className="w-full h-[240px] xl:h-[300px] bg-gradient-to-t from-amber-400/20 to-amber-400/5 rounded-t-xl border-x border-t border-amber-400/20 relative overflow-hidden">
                   <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-10"></div>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div className="w-1/3 flex flex-col items-center animate-in slide-in-from-bottom-4 duration-700 delay-200">
                <div className="bg-mission-panel-elevated/80 backdrop-blur-md border border-amber-700/40 rounded-2xl p-4 xl:p-5 w-full mb-4 shadow-xl text-center relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-700 text-white w-12 h-12 rounded-xl flex items-center justify-center font-bold font-mono text-xl shadow-lg transform rotate-3">
                    3
                  </div>
                  <h3 className="text-lg xl:text-xl font-bold text-white mt-4 truncate px-2">
                    {topThree[2].display_name}
                  </h3>
                  <p className="text-2xl xl:text-3xl font-mono font-bold text-radar-green mt-1">
                    {getSafePoints(topThree[2].total_points).toLocaleString()}
                  </p>
                </div>
                <div className="w-full h-[140px] xl:h-[160px] bg-gradient-to-t from-amber-700/20 to-amber-700/5 rounded-t-xl border-x border-t border-amber-700/20 relative overflow-hidden">
                   <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-10"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rest of Leaderboard */}
        <div className="col-span-1 lg:col-span-7 bg-mission-panel-elevated/40 backdrop-blur-xl border border-mission-border/50 rounded-3xl p-6 xl:p-8 shadow-2xl flex flex-col min-h-0 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
          
          <div className="overflow-y-auto pr-2 hide-scrollbar flex-1 relative">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-mission-bg/90 backdrop-blur-md z-10 shadow-sm">
                <tr className="text-mission-muted-text text-sm xl:text-base uppercase tracking-widest font-mono">
                  <th className="py-4 xl:py-5 font-bold w-20 xl:w-24 text-center rounded-tl-xl border-b border-mission-border/50">Rank</th>
                  <th className="py-4 xl:py-5 font-bold border-b border-mission-border/50">Explorer</th>
                  <th className="py-4 xl:py-5 font-bold text-center border-b border-mission-border/50">Lives</th>
                  <th className="py-4 xl:py-5 font-bold text-right rounded-tr-xl border-b border-mission-border/50">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mission-border/30">
                {rest.length === 0 ? (
                   <tr>
                     <td colSpan={4} className="py-12 text-center text-mission-muted-text text-lg font-medium">
                       No additional explorers in this class.
                     </td>
                   </tr>
                ) : (
                  rest.map((student, index) => (
                    <tr
                      key={student.id}
                      className="transition-colors hover:bg-mission-bg-secondary/50 group"
                    >
                      <td className="py-4 xl:py-5 text-center">
                        <span className="text-xl xl:text-2xl font-mono font-bold text-mission-muted-text group-hover:text-cyan-400 transition-colors">
                          {index + 4}
                        </span>
                      </td>
                      <td className="py-4 xl:py-5">
                        <span className="text-xl xl:text-2xl font-bold text-white tracking-wide">
                          {student.display_name}
                        </span>
                      </td>
                      <td className="py-4 xl:py-5">
                        <div className="flex justify-center items-center gap-1.5">
                          {Array.from({
                            length: Math.max(0, Math.min(5, Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0)),
                          }).map((_, i) => (
                            <Heart
                              key={i}
                              size={22}
                              className="text-mission-danger fill-mission-danger/80"
                            />
                          ))}
                          {(Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) > 5 && (
                            <span className="text-lg font-mono font-bold text-mission-danger ml-2 bg-mission-danger/10 px-2 py-0.5 rounded-md">
                              +{(Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) - 5}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 xl:py-5 text-right pr-2">
                        <span className="text-2xl xl:text-3xl font-mono font-bold text-radar-green">
                          {getSafePoints(student.total_points).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

