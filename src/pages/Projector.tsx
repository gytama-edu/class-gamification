import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Star, Heart } from 'lucide-react';
import { getRepository } from '../lib/data/repository';
import { ClassroomDashboardData } from '../lib/types/database';

export const Projector: React.FC = () => {
  const { classId } = useParams();
  const [data, setData] = useState<ClassroomDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!classId) return;
      try {
        const repo = getRepository();
        const dashboard = await repo.getClassroomDashboard(classId);
        if (isMounted) {
          setData(dashboard);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load leaderboard data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadData();
    // In a real app we might poll or use real-time subscriptions here
    const interval = setInterval(loadData, 5000); // Polling every 5s for prototype
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [classId]);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-cosmic-navy flex flex-col items-center justify-center font-sans p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cosmic-cyan mb-6"></div>
        <p className="text-2xl text-slate-400 font-bold tracking-widest uppercase">Initializing Leaderboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-cosmic-navy flex flex-col items-center justify-center font-sans p-8">
        <div className="bg-rose-500/10 border-2 border-rose-500/20 rounded-3xl p-10 text-center max-w-3xl">
          <h2 className="text-4xl font-bold text-rose-400 mb-4">System Error</h2>
          <p className="text-xl text-slate-300">{error || 'Class not found'}</p>
        </div>
      </div>
    );
  }

  // Sort students by points descending
  const sortedStudents = [...data.students].sort((a, b) => b.total_points - a.total_points);
  const topThree = sortedStudents.slice(0, 3);
  const rest = sortedStudents.slice(3);

  return (
    <div className="min-h-screen bg-cosmic-navy flex flex-col font-sans p-8 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIgLz4KPC9zdmc+')] opacity-20"></div>
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-cosmic-purple/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-cosmic-cyan/10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between mb-12 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-cosmic-cyan to-cosmic-purple rounded-2xl flex items-center justify-center shadow-lg shadow-cosmic-cyan/20">
            <Trophy className="text-white" size={40} />
          </div>
          <div>
            <h1 className="text-5xl font-bold text-white tracking-tight mb-2">{data.classroom.name}</h1>
            <p className="text-2xl text-cosmic-cyan font-medium tracking-wide uppercase">{data.classroom.level_name} • Meeting #{data.classroom.current_meeting_number}</p>
          </div>
        </div>
        <div className="text-right bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
          <p className="text-slate-300 font-medium text-lg flex items-center gap-2">
            <Star className="text-amber-400" size={24} /> Points stay saved.
          </p>
          <p className="text-slate-300 font-medium text-lg flex items-center gap-2 mt-2">
            <Heart className="text-rose-500" size={24} /> Lives reset every meeting.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 grid grid-cols-12 gap-8">
        {/* Top 3 Podium area */}
        <div className="col-span-12 lg:col-span-5 flex flex-col justify-end pb-8">
          <h2 className="text-3xl font-bold text-white mb-10 text-center tracking-widest uppercase text-slate-500">Top Explorers</h2>
          
          <div className="flex items-end justify-center gap-4 h-[400px]">
            {/* 2nd Place */}
            {topThree[1] && (
              <div className="w-1/3 flex flex-col items-center">
                <div className="bg-slate-800 border-2 border-slate-400 rounded-2xl p-4 w-full mb-4 shadow-xl text-center relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-400 text-slate-900 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl border-4 border-slate-800">2</div>
                  <h3 className="text-xl font-bold text-white mt-4 truncate">{topThree[1].display_name}</h3>
                  <p className="text-2xl font-mono font-bold text-cosmic-cyan mt-2">{topThree[1].total_points}</p>
                </div>
                <div className="w-full h-[200px] bg-gradient-to-t from-slate-400/20 to-slate-400/5 rounded-t-lg border-x border-t border-slate-400/30"></div>
              </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <div className="w-1/3 flex flex-col items-center z-10">
                <div className="bg-slate-800 border-2 border-amber-400 rounded-2xl p-5 w-full mb-4 shadow-2xl shadow-amber-500/20 text-center relative scale-110">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 w-16 h-16 rounded-full flex items-center justify-center font-bold text-3xl border-4 border-slate-800 shadow-lg shadow-amber-500/40">1</div>
                  <h3 className="text-2xl font-bold text-white mt-6 truncate">{topThree[0].display_name}</h3>
                  <p className="text-3xl font-mono font-bold text-amber-400 mt-2">{topThree[0].total_points}</p>
                </div>
                <div className="w-full h-[260px] bg-gradient-to-t from-amber-400/30 to-amber-400/10 rounded-t-lg border-x border-t border-amber-400/40"></div>
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div className="w-1/3 flex flex-col items-center">
                <div className="bg-slate-800 border-2 border-amber-700 rounded-2xl p-4 w-full mb-4 shadow-xl text-center relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-700 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl border-4 border-slate-800">3</div>
                  <h3 className="text-xl font-bold text-white mt-4 truncate">{topThree[2].display_name}</h3>
                  <p className="text-2xl font-mono font-bold text-cosmic-cyan mt-2">{topThree[2].total_points}</p>
                </div>
                <div className="w-full h-[160px] bg-gradient-to-t from-amber-700/30 to-amber-700/10 rounded-t-lg border-x border-t border-amber-700/40"></div>
              </div>
            )}
          </div>
        </div>

        {/* Rest of the leaderboard */}
        <div className="col-span-12 lg:col-span-7 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden flex flex-col">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-xl uppercase tracking-wider border-b-2 border-slate-700">
                <th className="pb-4 font-bold w-24 text-center">Rank</th>
                <th className="pb-4 font-bold">Explorer</th>
                <th className="pb-4 font-bold text-center">Lives</th>
                <th className="pb-4 font-bold text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rest.map((student, index) => (
                <tr key={student.id} className="transition-colors hover:bg-slate-800/30">
                  <td className="py-5 text-center">
                    <span className="text-2xl font-bold text-slate-500">{index + 4}</span>
                  </td>
                  <td className="py-5">
                    <span className="text-2xl font-bold text-white">{student.display_name}</span>
                  </td>
                  <td className="py-5">
                    <div className="flex justify-center items-center gap-1">
                      {Array.from({ length: Math.min(5, student.lives_remaining) }).map((_, i) => (
                        <Heart key={i} size={24} className="text-rose-500 fill-rose-500" />
                      ))}
                      {student.lives_remaining > 5 && (
                        <span className="text-xl font-bold text-rose-500 ml-2">+{student.lives_remaining - 5}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 text-right">
                    <span className="text-3xl font-mono font-bold text-cosmic-cyan">{student.total_points}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};
