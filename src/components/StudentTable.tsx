import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, Plus, Minus, RotateCcw, HeartOff, Star } from 'lucide-react';
import { useAppContext } from '../store';

export const StudentTable: React.FC = () => {
  const { classId } = useParams();
  const { dashboardData, addPoints, removePoints, removeLife, restoreLife, resetStudentLives } = useAppContext();

  if (!dashboardData || !classId) return null;

  // Sort by points descending for rank
  const sortedStudents = [...dashboardData.students].sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="bg-cosmic-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 text-slate-300 text-sm uppercase tracking-wider border-b border-slate-800">
              <th className="px-6 py-4 font-medium">Rank</th>
              <th className="px-6 py-4 font-medium">Student</th>
              <th className="px-6 py-4 font-medium text-center">Lives</th>
              <th className="px-6 py-4 font-medium text-right">Points</th>
              <th className="px-6 py-4 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedStudents.map((student, index) => (
              <tr key={student.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                    ${index === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                      index === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                      index === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' :
                      'text-slate-500'}`}
                  >
                    {index + 1}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link to={`/student/${student.id}`} className="font-medium text-white hover:text-cosmic-cyan transition-colors flex items-center gap-2">
                    {student.display_name}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center flex-nowrap gap-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="inline-flex items-center gap-[5px]">
                        {Array.from({ length: Math.min(5, student.lives_remaining) }).map((_, i) => (
                          <Heart key={i} size={16} className="text-rose-500 fill-rose-500 shrink-0" />
                        ))}
                        {student.lives_remaining === 0 && (
                          <HeartOff size={16} className="text-slate-600 shrink-0" />
                        )}
                      </div>
                      {student.lives_remaining > 5 && (
                        <span className="ml-[12px] text-xs font-bold text-rose-500">+{student.lives_remaining - 5}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-400 w-12 text-center whitespace-nowrap">
                      {student.lives_remaining} / {dashboardData.classroom.max_lives}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-cosmic-cyan text-lg">
                  {student.total_points.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-40 group-hover:opacity-100 transition-opacity">
                    
                    <div className="flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                      <button 
                        onClick={() => removePoints(classId, student.id, 10)}
                        title="Remove 10 Points"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <div className="flex items-center px-2 bg-slate-900 text-xs font-bold text-cosmic-cyan">
                        <Star size={12} className="mr-1 fill-cosmic-cyan" /> 10
                      </div>
                      <button 
                        onClick={() => addPoints(classId, student.id, 10)}
                        title="Add 10 Points"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="w-px h-6 bg-slate-700 mx-1"></div>

                    <div className="flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                      <button 
                        onClick={() => removeLife(classId, student.id)}
                        disabled={student.lives_remaining <= 0}
                        title="Remove 1 Life"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                      >
                        <HeartOff size={16} />
                      </button>
                      <button 
                        onClick={() => restoreLife(classId, student.id)}
                        disabled={student.lives_remaining >= dashboardData.classroom.max_lives}
                        title="Restore 1 Life"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                      >
                        <Heart size={16} />
                      </button>
                      <button 
                        onClick={() => resetStudentLives(classId, student.id)}
                        disabled={student.lives_remaining === dashboardData.classroom.max_lives}
                        title="Reset Lives to Max"
                        className="p-1.5 text-slate-400 hover:text-cosmic-cyan hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
