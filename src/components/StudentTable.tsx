import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Heart,
  Plus,
  Minus,
  RotateCcw,
  HeartOff,
  Star,
  Loader2,
} from "lucide-react";
import { useAppContext } from "../store";

export const StudentTable: React.FC = () => {
  const { classId } = useParams();
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

  // Sort by points descending for rank
  const sortedStudents = [...dashboardData.students].sort(
    (a, b) => b.total_points - a.total_points,
  );

  return (
    <div className="bg-mission-panel rounded-2xl border border-mission-border overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-mission-bg-secondary text-mission-secondary-text text-sm uppercase tracking-wider border-b border-mission-border">
              <th className="px-6 py-4 font-medium">Rank</th>
              <th className="px-6 py-4 font-medium">Student</th>
              <th className="px-6 py-4 font-medium text-center">Lives</th>
              <th className="px-6 py-4 font-medium text-right">Points</th>
              <th className="px-6 py-4 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mission-border">
            {sortedStudents.map((student, index) => (
              <tr
                key={student.id}
                className="hover:bg-mission-panel-elevated transition-colors group"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                    ${
                      index === 0
                        ? "bg-radar-green/20 text-radar-green border border-radar-green/30"
                        : index === 1
                          ? "bg-mission-secondary-text/20 text-mission-secondary-text border border-mission-secondary-text/30"
                          : index === 2
                            ? "bg-mission-warning/20 text-mission-warning border border-mission-warning/30"
                            : "text-mission-muted-text"
                    }`}
                  >
                    {index + 1}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    to={`/student/${student.id}`}
                    className="font-medium text-white hover:text-radar-green transition-colors flex items-center gap-2"
                  >
                    {student.display_name}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center flex-nowrap gap-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="inline-flex items-center gap-[5px]">
                        {Array.from({
                          length: Math.max(0, Math.min(5, Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0)),
                        }).map((_, i) => (
                          <Heart
                            key={i}
                            size={16}
                            className="text-mission-danger fill-mission-danger shrink-0"
                          />
                        ))}
                        {(Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) <= 0 && (
                          <HeartOff
                            size={16}
                            className="text-mission-muted-text shrink-0"
                          />
                        )}
                      </div>
                      {(Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) > 5 && (
                        <span className="ml-[12px] text-xs font-bold text-mission-danger">
                          +{(Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) - 5}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-mission-secondary-text w-12 text-center whitespace-nowrap">
                      {Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0} /{" "}
                      {dashboardData.classroom.max_lives}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-radar-green text-lg">
                  {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-40 group-hover:opacity-100 transition-opacity">
                    {processingId === student.id ? (
                      <div className="flex justify-center items-center w-full px-4 text-radar-green">
                        <Loader2 size={18} className="animate-spin" />
                      </div>
                    ) : !dashboardData.activeMeeting ? (
                      <div className="flex justify-center items-center w-full px-4">
                        <span className="text-xs font-medium text-mission-muted-text bg-mission-bg-secondary px-3 py-1.5 rounded-lg border border-mission-border">
                          No active meeting
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex bg-mission-panel-elevated rounded-lg overflow-hidden border border-mission-border">
                          <button
                            onClick={() =>
                              handleAction(student.id, () =>
                                removePoints(classId, student.id, 10),
                              )
                            }
                            title="Remove 10 Points"
                            className="p-1.5 text-mission-secondary-text hover:text-white hover:bg-mission-bg transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <div className="flex items-center px-2 bg-mission-bg-secondary text-xs font-bold text-radar-green">
                            <Star size={12} className="mr-1 fill-radar-green" />{" "}
                            10
                          </div>
                          <button
                            onClick={() =>
                              handleAction(student.id, () =>
                                addPoints(classId, student.id, 10),
                              )
                            }
                            title="Add 10 Points"
                            className="p-1.5 text-mission-secondary-text hover:text-white hover:bg-mission-bg transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <div className="w-px h-6 bg-mission-border mx-1"></div>

                        <div className="flex bg-mission-panel-elevated rounded-lg overflow-hidden border border-mission-border">
                          <button
                            onClick={() =>
                              handleAction(student.id, () =>
                                removeLife(classId, student.id),
                              )
                            }
                            disabled={(Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) <= 0}
                            title="Remove 1 Life"
                            className="p-1.5 text-mission-secondary-text hover:text-mission-danger hover:bg-mission-bg disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                          >
                            <HeartOff size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleAction(student.id, () =>
                                restoreLife(classId, student.id),
                              )
                            }
                            disabled={
                              (Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) >=
                              dashboardData.classroom.max_lives
                            }
                            title="Restore 1 Life"
                            className="p-1.5 text-mission-secondary-text hover:text-mission-danger hover:bg-mission-bg disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                          >
                            <Heart size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleAction(student.id, () =>
                                resetStudentLives(classId, student.id),
                              )
                            }
                            disabled={
                              (Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0) ===
                              dashboardData.classroom.max_lives
                            }
                            title="Reset Lives to Max"
                            className="p-1.5 text-mission-secondary-text hover:text-radar-green hover:bg-mission-bg disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                          >
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      </>
                    )}
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
