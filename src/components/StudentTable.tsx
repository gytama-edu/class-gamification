import React, { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Heart,
  Plus,
  Minus,
  RotateCcw,
  HeartOff,
  Star,
  Loader2,
  Users
} from "lucide-react";
import { useAppContext } from "../store";
import { EmptyState, Button, IconButton } from "./ui";
import { StudentWithCurrentState } from "../lib/types/database";

export const StudentTable: React.FC = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const {
    dashboardData,
    addPoints,
    removePoints,
    removeLife,
    restoreLife,
    resetStudentLives,
  } = useAppContext();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!dashboardData || !classId) return null;

  const handleAction = async (
    studentId: string,
    action: () => Promise<void>,
  ) => {
    if (processingId === studentId) return;
    setProcessingId(studentId);
    try {
      await action();
    } finally {
      setProcessingId(null);
    }
  };

  const sortedStudents = [...dashboardData.students]
    .filter(s => s.is_active === true)
    .sort((a, b) => b.total_points - a.total_points);

  if (sortedStudents.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No Students Yet"
        description="Add students before running the live meeting."
        action={
          <Button variant="secondary" onClick={() => navigate(`/teacher/classes/${classId}/students`)}>
            Manage Students
          </Button>
        }
        className="rounded-none border-0"
      />
    );
  }

  const renderRank = (index: number) => {
    const rank = index + 1;
    let rankColor = "bg-mission-panel-strong text-mission-muted-text border border-mission-border/50";
    if (rank === 1) rankColor = "bg-amber-500/10 text-amber-500 border border-amber-500/30";
    else if (rank === 2) rankColor = "bg-slate-300/10 text-slate-300 border border-slate-300/30";
    else if (rank === 3) rankColor = "bg-orange-700/10 text-orange-400 border border-orange-700/30";
    
    return (
      <div className={`flex items-center justify-center w-7 h-7 rounded-md font-bold text-xs ${rankColor}`}>
        {rank}
      </div>
    );
  };

  const renderLives = (student: StudentWithCurrentState) => {
    const maxLives = dashboardData.classroom.max_lives;
    const currentLives = Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0;
    
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          {currentLives <= 0 ? (
            <HeartOff size={16} className="text-mission-danger/50 shrink-0" />
          ) : (
            <>
              {Array.from({ length: Math.min(5, currentLives) }).map((_, i) => (
                <Heart key={i} size={14} className="text-mission-danger fill-mission-danger shrink-0" />
              ))}
              {currentLives > 5 && (
                <span className="text-xs font-bold text-mission-danger">
                  +{currentLives - 5}
                </span>
              )}
            </>
          )}
        </div>
        <span className={`text-xs font-mono font-medium ${currentLives === 0 ? 'text-mission-danger' : 'text-mission-secondary-text'}`}>
          {currentLives} / {maxLives}
        </span>
      </div>
    );
  };

  const renderPointControls = (student: StudentWithCurrentState) => {
    const isProcessing = processingId === student.id;
    return (
      <div className="flex bg-mission-panel-strong rounded-lg overflow-hidden border border-mission-border/50">
        <button
          onClick={() => handleAction(student.id, () => removePoints(classId, student.id, 10))}
          disabled={isProcessing || !dashboardData.activeMeeting}
          title="Remove 10 Points"
          className="p-2 text-mission-secondary-text hover:text-white hover:bg-mission-bg-secondary disabled:opacity-50 transition-colors"
        >
          <Minus size={14} />
        </button>
        <div className="flex items-center justify-center min-w-[3rem] px-2 bg-mission-bg-secondary text-xs font-bold text-radar-green border-x border-mission-border/50">
          <Star size={12} className="mr-1 fill-radar-green" /> 10
        </div>
        <button
          onClick={() => handleAction(student.id, () => addPoints(classId, student.id, 10))}
          disabled={isProcessing || !dashboardData.activeMeeting}
          title="Add 10 Points"
          className="p-2 text-mission-secondary-text hover:text-white hover:bg-mission-bg-secondary disabled:opacity-50 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  };

  const renderLifeControls = (student: StudentWithCurrentState) => {
    const isProcessing = processingId === student.id;
    const currentLives = Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0;
    const maxLives = dashboardData.classroom.max_lives;

    return (
      <div className="flex bg-mission-panel-strong rounded-lg overflow-hidden border border-mission-border/50">
        <button
          onClick={() => handleAction(student.id, () => removeLife(classId, student.id))}
          disabled={isProcessing || currentLives <= 0 || !dashboardData.activeMeeting}
          title="Remove 1 Life"
          className="p-2 text-mission-secondary-text hover:text-mission-danger hover:bg-mission-danger/10 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
        >
          <HeartOff size={14} />
        </button>
        <button
          onClick={() => handleAction(student.id, () => restoreLife(classId, student.id))}
          disabled={isProcessing || currentLives >= maxLives || !dashboardData.activeMeeting}
          title="Restore 1 Life"
          className="p-2 text-mission-secondary-text hover:text-cyan-400 hover:bg-cyan-400/10 disabled:opacity-50 disabled:hover:bg-transparent border-x border-mission-border/50 transition-colors"
        >
          <Heart size={14} />
        </button>
        <button
          onClick={() => handleAction(student.id, () => resetStudentLives(classId, student.id))}
          disabled={isProcessing || currentLives === maxLives || !dashboardData.activeMeeting}
          title="Reset Lives to Max"
          className="p-2 text-mission-secondary-text hover:text-radar-green hover:bg-radar-green/10 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Card View */}
      <div className="block md:hidden bg-mission-bg p-4 space-y-4">
        {sortedStudents.map((student, index) => (
          <div key={student.id} className="bg-mission-panel border border-mission-border/50 rounded-xl p-4 flex flex-col relative overflow-hidden group">
             {processingId === student.id && (
               <div className="absolute inset-0 bg-mission-panel/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-radar-green bg-mission-panel-elevated px-4 py-2 rounded-lg border border-mission-border">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-wider">Updating</span>
                  </div>
               </div>
             )}
             
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                {renderRank(index)}
                <div>
                  <Link to={`/student/${student.id}`} className="font-bold text-white text-base hover:text-radar-green transition-colors">
                    {student.display_name}
                  </Link>
                  <div className="mt-1">
                    {renderLives(student)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-radar-green text-lg">
                   {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2 pt-4 border-t border-mission-border/30">
              {renderPointControls(student)}
              {renderLifeControls(student)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-mission-panel text-mission-secondary-text text-xs uppercase tracking-wider border-b border-mission-border/50">
              <th className="px-5 py-3 font-medium w-16">Rank</th>
              <th className="px-5 py-3 font-medium">Student</th>
              <th className="px-5 py-3 font-medium w-48">Lives</th>
              <th className="px-5 py-3 font-medium text-right w-32">Points</th>
              <th className="px-5 py-3 font-medium text-center w-64">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mission-border/30 bg-mission-bg/50">
            {sortedStudents.map((student, index) => (
              <tr
                key={student.id}
                className="hover:bg-mission-panel/50 transition-colors group relative h-[60px]"
              >
                <td className="px-5 py-3 whitespace-nowrap">
                  {renderRank(index)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <Link
                    to={`/student/${student.id}`}
                    className="font-medium text-sm text-white hover:text-radar-green transition-colors"
                  >
                    {student.display_name}
                  </Link>
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  {renderLives(student)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-right font-mono font-bold text-radar-green">
                  {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
                </td>
                <td className="px-5 py-3 whitespace-nowrap relative">
                  {processingId === student.id ? (
                    <div className="flex justify-center items-center w-full text-radar-green">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      <span className="text-xs font-medium">Updating...</span>
                    </div>
                  ) : !dashboardData.activeMeeting ? (
                    <div className="flex justify-center items-center w-full">
                      <span className="text-xs font-medium text-mission-muted-text">
                        No active meeting
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3 opacity-100">
                      {renderPointControls(student)}
                      <div className="w-px h-5 bg-mission-border/50"></div>
                      {renderLifeControls(student)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
