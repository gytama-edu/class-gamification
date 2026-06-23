import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Trophy, ArrowLeft, Star, HeartOff } from 'lucide-react';
import { getRepository } from '../lib/data/repository';
import { StudentWithCurrentState, Classroom } from '../lib/types/database';

export const StudentView: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  
  const [student, setStudent] = useState<StudentWithCurrentState | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [rank, setRank] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadStudent = async () => {
      if (!studentId) return;
      try {
        const repo = getRepository();
        const profile = await repo.getStudentProfile(studentId);
        if (profile && isMounted) {
          setStudent(profile);
          const classes = await repo.getClasses();
          const cls = classes.find(c => c.id === profile.class_id);
          if (cls) setClassroom(cls);

          const leaderboard = await repo.getLeaderboard(profile.class_id);
          const idx = leaderboard.findIndex(l => l.id === studentId);
          setRank(idx + 1);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadStudent();
    return () => { isMounted = false; };
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cosmic-cyan mb-4"></div>
        <p className="text-slate-400 font-medium tracking-wide">Loading Explorer Data...</p>
      </div>
    );
  }

  if (!student || !classroom) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <Star className="text-slate-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Student Not Found</h2>
        <p className="text-slate-400 mb-6">The student you are looking for does not exist.</p>
        <Link to="/teacher/classes" className="px-6 py-2 bg-cosmic-panel border border-slate-700 rounded-lg text-white hover:bg-slate-800 transition-colors flex items-center gap-2">
          <ArrowLeft size={18} />
          Return to Classes
        </Link>
      </div>
    );
  }

  const livesPercentage = (student.lives_remaining / classroom.max_lives) * 100;

  return (
    <div className="max-w-2xl mx-auto py-8 animate-in fade-in duration-500">
      <Link to={`/teacher/classes/${student.class_id}`} className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8">
        <ArrowLeft size={18} />
        Back to Dashboard
      </Link>

      <div className="bg-cosmic-panel border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Header Decor */}
        <div className="h-32 bg-gradient-to-br from-cosmic-cyan/20 to-cosmic-purple/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIgLz4KPC9zdmc+')] opacity-30"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-cosmic-cyan/30 rounded-full blur-3xl"></div>
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-cosmic-purple/30 rounded-full blur-3xl"></div>
        </div>

        <div className="px-8 pb-8 -mt-16 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="flex items-end gap-5">
              <div className="w-24 h-24 bg-slate-900 border-4 border-cosmic-panel rounded-2xl flex items-center justify-center shadow-xl">
                <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-cosmic-cyan to-cosmic-purple">
                  {student.display_name.charAt(0)}
                </span>
              </div>
              <div className="pb-2">
                <h1 className="text-3xl font-bold text-white mb-1">{student.display_name}</h1>
                <p className="text-cosmic-cyan font-medium flex items-center gap-2">
                  {classroom.name} <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span> {classroom.level_name}
                </p>
              </div>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-3 backdrop-blur-sm self-start md:self-end mb-2">
              <div className="text-amber-400">
                <Trophy size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Class Rank</p>
                <p className="text-lg font-bold text-white leading-none">#{rank}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lives Card */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium flex items-center gap-2">
                  <Heart className="text-rose-500" size={18} />
                  Current Lives
                </h3>
                <span className="text-xl font-bold text-white">
                  {student.lives_remaining} <span className="text-slate-500 text-sm">/ {classroom.max_lives}</span>
                </span>
              </div>
              
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    livesPercentage > 50 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                    livesPercentage > 25 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                    'bg-gradient-to-r from-rose-500 to-rose-400'
                  }`}
                  style={{ width: `${livesPercentage}%` }}
                ></div>
              </div>

              <div className="flex flex-wrap gap-1 mt-4">
                {Array.from({ length: classroom.max_lives }).map((_, i) => (
                  <div key={i}>
                    {i < student.lives_remaining ? (
                      <Heart size={20} className="text-rose-500 fill-rose-500" />
                    ) : (
                      <HeartOff size={20} className="text-slate-700" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Points Card */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 font-medium flex items-center gap-2">
                  <Star className="text-cosmic-cyan" size={18} />
                  Total Points
                </h3>
              </div>
              
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cosmic-cyan to-blue-400 font-mono">
                  {student.total_points.toLocaleString()}
                </span>
                <span className="text-slate-500 font-medium">pts</span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-sm text-slate-300 italic">
                  "Keep exploring the cosmos! Points remain saved across all meetings."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
