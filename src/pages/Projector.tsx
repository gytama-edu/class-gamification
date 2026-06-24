import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Trophy, Star, Heart } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { ClassroomDashboardData } from "../lib/types/database";
import { useClassroomRealtime } from "../lib/realtime/useClassroomRealtime";
import { ConnectionStatus } from "../components/ConnectionStatus";

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

  const { status } = useClassroomRealtime(classId || null, loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-mission-bg flex flex-col items-center justify-center font-sans p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-radar-green mb-6"></div>
        <p className="text-2xl text-mission-muted-text font-bold tracking-widest uppercase">
          Initializing Leaderboard...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-mission-bg flex flex-col items-center justify-center font-sans p-8">
        <div className="bg-mission-danger/10 border-2 border-mission-danger/20 rounded-3xl p-10 text-center max-w-3xl">
          <h2 className="text-4xl font-bold text-mission-danger mb-4">
            System Error
          </h2>
          <p className="text-xl text-mission-primary-text">{error || "Class not found"}</p>
        </div>
      </div>
    );
  }

  // Sort students by points descending
  const sortedStudents = [...data.students].sort(
    (a, b) => b.total_points - a.total_points,
  );
  const topThree = sortedStudents.slice(0, 3);
  const rest = sortedStudents.slice(3);

  return (
    <div className="min-h-screen bg-mission-bg flex flex-col font-sans p-8 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-30"></div>
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-radar-green/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-radar-green/5 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between mb-12 bg-mission-bg-secondary/80 backdrop-blur-md border border-mission-border rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-mission-panel border border-mission-border rounded-2xl flex items-center justify-center shadow-lg">
            <Trophy className="text-radar-green" size={40} />
          </div>
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-5xl font-bold text-white tracking-tight">
                {data.classroom.name}
              </h1>
              <ConnectionStatus status={status} />
            </div>
            {data.activeMeeting ? (
              <p className="text-2xl text-radar-green font-medium tracking-wide uppercase">
                {data.classroom.level_name} • Meeting #
                {data.classroom.current_meeting_number}
              </p>
            ) : (
              <p className="text-2xl text-mission-danger font-bold tracking-wide uppercase bg-mission-danger/10 inline-block px-3 py-1 rounded border border-mission-danger/20">
                Meeting Complete
              </p>
            )}
          </div>
        </div>
        <div className="text-right bg-mission-panel p-5 rounded-2xl border border-mission-border">
          {data.activeMeeting ? (
            <>
              <p className="text-mission-primary-text font-medium text-lg flex items-center gap-2">
                <Star className="text-radar-green" size={24} /> Points stay saved.
              </p>
              <p className="text-mission-primary-text font-medium text-lg flex items-center gap-2 mt-2">
                <Heart className="text-mission-danger" size={24} /> Lives reset every
                meeting.
              </p>
            </>
          ) : (
            <>
              <p className="text-mission-primary-text font-medium text-lg flex items-center gap-2">
                <Star className="text-radar-green" size={24} /> Points have been
                saved.
              </p>
              <p className="text-mission-primary-text font-medium text-lg flex items-center gap-2 mt-2">
                <Heart className="text-mission-muted-text" size={24} /> The next meeting
                will begin with refreshed lives.
              </p>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 grid grid-cols-12 gap-8">
        {/* Top 3 Podium area */}
        <div className="col-span-12 lg:col-span-5 flex flex-col justify-end pb-8">
          <h2 className="text-3xl font-bold text-white mb-10 text-center tracking-widest uppercase text-mission-muted-text">
            Top Explorers
          </h2>

          <div className="flex items-end justify-center gap-4 h-[400px]">
            {/* 2nd Place */}
            {topThree[1] && (
              <div className="w-1/3 flex flex-col items-center">
                <div className="bg-mission-panel border-2 border-mission-muted-text rounded-2xl p-4 w-full mb-4 shadow-xl text-center relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-mission-muted-text text-mission-bg w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl border-4 border-mission-border">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-white mt-4 truncate">
                    {topThree[1].display_name}
                  </h3>
                  <p className="text-2xl font-mono font-bold text-radar-green mt-2">
                    {topThree[1].total_points}
                  </p>
                </div>
                <div className="w-full h-[200px] bg-gradient-to-t from-mission-muted-text/20 to-mission-muted-text/5 rounded-t-lg border-x border-t border-mission-muted-text/30"></div>
              </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <div className="w-1/3 flex flex-col items-center z-10">
                <div className="bg-mission-panel border-2 border-radar-green rounded-2xl p-5 w-full mb-4 shadow-2xl shadow-radar-green/20 text-center relative scale-110">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-radar-green text-mission-bg w-16 h-16 rounded-full flex items-center justify-center font-bold text-3xl border-4 border-mission-border shadow-lg shadow-radar-green/40">
                    1
                  </div>
                  <h3 className="text-2xl font-bold text-white mt-6 truncate">
                    {topThree[0].display_name}
                  </h3>
                  <p className="text-3xl font-mono font-bold text-radar-green mt-2">
                    {topThree[0].total_points}
                  </p>
                </div>
                <div className="w-full h-[260px] bg-gradient-to-t from-radar-green/30 to-radar-green/10 rounded-t-lg border-x border-t border-radar-green/40"></div>
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div className="w-1/3 flex flex-col items-center">
                <div className="bg-mission-panel border-2 border-mission-warning rounded-2xl p-4 w-full mb-4 shadow-xl text-center relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-mission-warning text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl border-4 border-mission-border">
                    3
                  </div>
                  <h3 className="text-xl font-bold text-white mt-4 truncate">
                    {topThree[2].display_name}
                  </h3>
                  <p className="text-2xl font-mono font-bold text-radar-green mt-2">
                    {topThree[2].total_points}
                  </p>
                </div>
                <div className="w-full h-[160px] bg-gradient-to-t from-mission-warning/30 to-mission-warning/10 rounded-t-lg border-x border-t border-mission-warning/40"></div>
              </div>
            )}
          </div>
        </div>

        {/* Rest of the leaderboard */}
        <div className="col-span-12 lg:col-span-7 bg-mission-bg-secondary/80 backdrop-blur-md border border-mission-border rounded-3xl p-8 shadow-2xl overflow-hidden flex flex-col">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-mission-secondary-text text-xl uppercase tracking-wider border-b-2 border-mission-border">
                <th className="pb-4 font-bold w-24 text-center">Rank</th>
                <th className="pb-4 font-bold">Explorer</th>
                <th className="pb-4 font-bold text-center">Lives</th>
                <th className="pb-4 font-bold text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mission-border">
              {rest.map((student, index) => (
                <tr
                  key={student.id}
                  className="transition-colors hover:bg-mission-panel-elevated"
                >
                  <td className="py-5 text-center">
                    <span className="text-2xl font-bold text-mission-muted-text">
                      {index + 4}
                    </span>
                  </td>
                  <td className="py-5">
                    <span className="text-2xl font-bold text-white">
                      {student.display_name}
                    </span>
                  </td>
                  <td className="py-5">
                    <div className="flex justify-center items-center gap-1">
                      {Array.from({
                        length: Math.min(5, student.lives_remaining),
                      }).map((_, i) => (
                        <Heart
                          key={i}
                          size={24}
                          className="text-mission-danger fill-mission-danger"
                        />
                      ))}
                      {student.lives_remaining > 5 && (
                        <span className="text-xl font-bold text-mission-danger ml-2">
                          +{student.lives_remaining - 5}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 text-right">
                    <span className="text-3xl font-mono font-bold text-radar-green">
                      {student.total_points}
                    </span>
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
