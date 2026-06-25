import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Heart,
  Trophy,
  ArrowLeft,
  Star,
  HeartOff,
  Award,
  Zap,
  Activity,
  Users,
  Shield,
  ShieldCheck,
  Flag,
  CalendarCheck,
  TrendingUp,
  Medal,
  Rocket,
  Radio,
  Crown,
} from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { AchievementCard } from "../components/AchievementCard";
import {
  StudentWithCurrentState,
  Classroom,
  StudentAchievement,
} from "../lib/types/database";
import { useClassroomRealtime } from "../lib/realtime/useClassroomRealtime";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { AwardRecognitionModal } from "../components/AwardRecognitionModal";

const IconMap: Record<string, React.FC<any>> = {
  radio: Radio,
  zap: Zap,
  star: Star,
  award: Award,
  crown: Crown,
  flag: Flag,
  users: Users,
  "calendar-check": CalendarCheck,
  shield: Shield,
  "trending-up": TrendingUp,
  trophy: Trophy,
  medal: Medal,
  "shield-check": ShieldCheck,
  heart: Heart,
  rocket: Rocket,
  activity: Activity,
};

export const StudentView: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();

  const [student, setStudent] = useState<StudentWithCurrentState | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [rank, setRank] = useState<number>(0);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);

  const loadStudent = useCallback(async () => {
    if (!studentId) return;
    try {
      const repo = getRepository();
      const profile = await repo.getStudentProfile(studentId);
      if (profile) {
        setStudent(profile);
        const dashboard = await repo.getClassroomDashboard(profile.class_id);
        setClassroom(dashboard.classroom);
        setActiveMeeting(dashboard.activeMeeting);

        const leaderboard = await repo.getLeaderboard(profile.class_id);
        const idx = leaderboard.findIndex((l) => l.id === studentId);
        setRank(idx + 1);

        const achs = await repo.getStudentAchievements(studentId);
        setAchievements(achs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  const { status } = useClassroomRealtime(
    student?.class_id || null,
    activeMeeting?.id || null,
    loadStudent,
  );

  useEffect(() => {
    loadStudent();
  }, [loadStudent]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-radar-green mb-4"></div>
        <p className="text-mission-secondary-text font-medium tracking-wide">
          Loading Explorer Data...
        </p>
      </div>
    );
  }

  if (!student || !classroom) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-mission-bg-secondary rounded-full flex items-center justify-center mb-6">
          <Star className="text-mission-muted-text" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Student Not Found
        </h2>
        <p className="text-mission-secondary-text mb-6">
          The student you are looking for does not exist.
        </p>
        <Link
          to="/teacher/classes"
          className="px-6 py-2 bg-mission-panel border border-mission-border rounded-lg text-white hover:bg-mission-bg transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={18} />
          Return to Classes
        </Link>
      </div>
    );
  }

  const safeLives = Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0;
  const livesPercentage = (safeLives / classroom.max_lives) * 100;

  return (
    <div className="max-w-2xl mx-auto py-8 animate-in fade-in duration-500">
      <Link
        to={`/teacher/classes/${student.class_id}`}
        className="inline-flex items-center gap-2 text-mission-secondary-text hover:text-white transition-colors mb-8"
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </Link>

      <div className="bg-mission-panel border border-mission-border rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Header Decor */}
        <div className="h-32 bg-mission-bg-secondary relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-30"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-radar-green/10 rounded-full blur-3xl"></div>
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-radar-green/5 rounded-full blur-3xl"></div>
        </div>

        <div className="px-8 pb-8 -mt-16 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="flex items-end gap-5">
              <div className="w-24 h-24 bg-mission-bg border-4 border-mission-panel rounded-2xl flex items-center justify-center shadow-xl">
                <span className="text-4xl font-bold text-radar-green">
                  {student.display_name.charAt(0)}
                </span>
              </div>
              <div className="pb-2">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-white">
                    {student.display_name}
                  </h1>
                  <ConnectionStatus status={status} />
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-radar-green font-medium flex items-center gap-2">
                    {classroom.name}{" "}
                    <span className="w-1.5 h-1.5 rounded-full bg-mission-border"></span>{" "}
                    {classroom.level_name}
                  </p>
                  {!activeMeeting && (
                    <span className="px-2 py-0.5 bg-mission-danger/10 text-mission-danger border border-mission-danger/20 rounded text-xs font-bold uppercase tracking-wider">
                      Meeting Complete
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-mission-bg-secondary border border-mission-border rounded-xl px-4 py-2 flex items-center gap-3 backdrop-blur-sm self-start md:self-end mb-2">
              <div className="text-radar-green">
                <Trophy size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-mission-muted-text font-bold">
                  Class Rank
                </p>
                <p className="text-lg font-bold text-white leading-none">
                  #{rank}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lives Card */}
            <div className="bg-mission-bg-secondary border border-mission-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-mission-secondary-text font-medium flex items-center gap-2">
                  <Heart className="text-mission-danger" size={18} />
                  Current Lives
                </h3>
                <span className="text-xl font-bold text-white">
                  {safeLives}{" "}
                  <span className="text-mission-muted-text text-sm">
                    / {classroom.max_lives}
                  </span>
                </span>
              </div>

              <div className="h-3 bg-mission-panel-elevated rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    livesPercentage > 50
                      ? "bg-radar-green"
                      : livesPercentage > 25
                        ? "bg-mission-warning"
                        : "bg-mission-danger"
                  }`}
                  style={{ width: `${livesPercentage}%` }}
                ></div>
              </div>

              <div className="flex flex-wrap gap-1 mt-4">
                {Array.from({ length: classroom.max_lives }).map((_, i) => (
                  <div key={i}>
                    {i < safeLives ? (
                      <Heart
                        size={20}
                        className="text-mission-danger fill-mission-danger"
                      />
                    ) : (
                      <HeartOff size={20} className="text-mission-muted-text" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Points Card */}
            <div className="bg-mission-bg-secondary border border-mission-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-mission-secondary-text font-medium flex items-center gap-2">
                  <Star className="text-radar-green" size={18} />
                  Total Points
                </h3>
              </div>

              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold text-radar-green font-mono">
                  {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
                </span>
                <span className="text-mission-muted-text font-medium">pts</span>
              </div>

              <div className="bg-mission-panel rounded-xl p-4 border border-mission-border">
                <p className="text-sm text-mission-secondary-text italic">
                  "Keep exploring the cosmos! Points remain saved across all
                  meetings."
                </p>
              </div>
            </div>
          </div>

          {/* Achievements Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="text-radar-green" />
                  Achievements
                </h3>
                <span className="bg-radar-green/10 text-radar-green text-xs font-bold px-2 py-1 rounded">
                  {achievements.length} UNLOCKED
                </span>
              </div>
              <button
                onClick={() => setIsAwardModalOpen(true)}
                className="text-xs font-bold px-3 py-1.5 bg-radar-green/10 text-radar-green border border-radar-green/30 hover:bg-radar-green hover:text-black transition-colors rounded flex items-center gap-1.5"
              >
                <Star size={14} />
                AWARD RECOGNITION
              </button>
            </div>

            {achievements.length === 0 ? (
              <div className="bg-mission-bg-secondary border border-mission-border rounded-2xl p-8 text-center">
                <Award className="mx-auto text-mission-border mb-3" size={32} />
                <p className="text-mission-muted-text">
                  No achievements unlocked yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {achievements.map((ach) => (
                  <AchievementCard key={ach.id} achievement={ach} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AwardRecognitionModal
        isOpen={isAwardModalOpen}
        onClose={() => setIsAwardModalOpen(false)}
        studentId={student.id}
        studentName={student.display_name}
        onAwarded={loadStudent}
      />
    </div>
  );
};
