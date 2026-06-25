import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Heart,
  Trophy,
  ArrowLeft,
  Star,
  HeartOff,
  Award,
  AlertTriangle,
  RefreshCw,
  Medal
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
import { ClassTypeBadge } from "../components/ClassTypeBadge";
import { 
  PageHeader, 
  Panel, 
  Button, 
  StatCard, 
  LoadingSkeleton,
  EmptyState
} from "../components/ui";

export const StudentView: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();

  const [student, setStudent] = useState<StudentWithCurrentState | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [rank, setRank] = useState<number>(0);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);

  const loadStudent = useCallback(async () => {
    if (!studentId) return;
    setIsLoading(true);
    setError(null);
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
      } else {
        setStudent(null);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load student profile.");
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
      <div className="max-w-6xl mx-auto py-8 animate-in fade-in duration-500 space-y-6">
         <LoadingSkeleton />
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <LoadingSkeleton />
           <LoadingSkeleton />
           <LoadingSkeleton />
           <LoadingSkeleton />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <LoadingSkeleton />
           <LoadingSkeleton />
         </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12 animate-in fade-in duration-500">
         <EmptyState
            icon={AlertTriangle}
            title="Student Profile Unavailable"
            description="We encountered an error while trying to load this student's profile."
            action={{
              label: "Retry",
              onClick: loadStudent
            }}
            className="border-mission-danger/20 bg-mission-danger/5"
         />
         <div className="mt-8 flex justify-center">
            <Link to="/teacher/classes">
              <Button variant="ghost"><ArrowLeft size={16} className="mr-2" /> Back to Classes</Button>
            </Link>
         </div>
      </div>
    );
  }

  if (!student || !classroom) {
    return (
      <div className="max-w-6xl mx-auto py-12 animate-in fade-in duration-500">
         <EmptyState
            icon={Star}
            title="Student Not Found"
            description="The student you are looking for does not exist or has been removed."
            action={{
              label: "Back to Classes",
              onClick: () => window.history.back()
            }}
         />
      </div>
    );
  }

  const safeLives = Number.isFinite(Number(student.lives_remaining)) ? Number(student.lives_remaining) : 0;
  const livesPercentage = (safeLives / classroom.max_lives) * 100;
  const maxLivesToRender = Math.min(classroom.max_lives, 5);
  const livesOverflow = classroom.max_lives > 5 ? classroom.max_lives - 5 : 0;

  return (
    <div className="max-w-6xl mx-auto py-6 animate-in fade-in duration-500 pb-16">
      <Link
        to={`/teacher/classes/${student.class_id}/students`}
        className="inline-flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors mb-6 font-medium"
      >
        <ArrowLeft size={16} />
        Back to Students
      </Link>

      {/* Identity Header */}
      <Panel className="p-0 border-mission-border/50 overflow-hidden mb-8 relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-radar-green opacity-80" />
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')]">
           <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-mission-panel-strong border border-mission-border/50 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                 <span className="text-3xl font-display font-bold text-white">
                    {student.display_name.charAt(0).toUpperCase()}
                 </span>
              </div>
              <div>
                 <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
                       {student.display_name}
                    </h1>
                    <ConnectionStatus status={status} />
                 </div>
                 <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="text-sm font-medium text-radar-green flex items-center gap-1.5">
                       {classroom.name}
                       <span className="w-1 h-1 rounded-full bg-mission-border" />
                       {classroom.level_name}
                    </span>
                    <ClassTypeBadge type={classroom.class_type} compact />
                    {!student.is_active && (
                       <span className="px-2 py-0.5 bg-mission-secondary-text/10 text-mission-secondary-text border border-mission-secondary-text/20 rounded text-[10px] font-bold uppercase tracking-wider">
                         Inactive
                       </span>
                    )}
                 </div>
              </div>
           </div>
           
           <div className="flex flex-col items-start md:items-end gap-2">
              <div className="flex items-center gap-2">
                 {activeMeeting ? (
                    <span className="px-2.5 py-1 bg-radar-green/10 text-radar-green border border-radar-green/20 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 bg-radar-green rounded-full animate-pulse" />
                       In Active Meeting
                    </span>
                 ) : (
                    <span className="px-2.5 py-1 bg-mission-panel-elevated text-mission-muted-text border border-mission-border/50 rounded-md text-[10px] font-bold uppercase tracking-wider">
                       No Active Meeting
                    </span>
                 )}
              </div>
           </div>
        </div>
      </Panel>

      {/* Core Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
           title="Permanent Points"
           value={(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
           icon={Star}
           trend="Overall"
           accentColor="border-radar-green/30"
           iconColor="text-radar-green"
           bgColor="bg-radar-green/10"
        />
        <StatCard
           title="Class Rank"
           value={`#${rank}`}
           icon={Trophy}
           trend={`of ${allStudentsCountPlaceholder(rank, classroom)} students`}
           accentColor="border-amber-500/30"
           iconColor="text-amber-500"
           bgColor="bg-amber-500/10"
        />
        <StatCard
           title="Current Lives"
           value={`${safeLives}/${classroom.max_lives}`}
           icon={Heart}
           trend={activeMeeting ? "Active session" : "Last session state"}
           accentColor="border-cyan-400/30"
           iconColor="text-cyan-400"
           bgColor="bg-cyan-400/10"
        />
        <StatCard
           title="Achievements Earned"
           value={achievements.length.toString()}
           icon={Medal}
           trend="Total unlocked"
           accentColor="border-purple-400/30"
           iconColor="text-purple-400"
           bgColor="bg-purple-400/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         {/* Session Lives */}
         <Panel className="col-span-1 lg:col-span-2 p-6 flex flex-col justify-between border-mission-border/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 opacity-80" />
            <div className="flex justify-between items-start mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                     <Heart size={20} />
                  </div>
                  <div>
                     <h3 className="text-white font-bold font-display tracking-tight">Session Lives</h3>
                     <p className="text-sm text-mission-secondary-text">Current meeting vitality status.</p>
                  </div>
               </div>
               <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-white">{safeLives} <span className="text-base text-mission-muted-text font-normal">/ {classroom.max_lives}</span></div>
               </div>
            </div>
            
            <div className="mb-4">
               <div className="h-2.5 bg-mission-panel-elevated rounded-full overflow-hidden mb-4 border border-mission-border/50">
                 <div
                   className={`h-full rounded-full transition-all duration-500 ${
                     livesPercentage > 50
                       ? "bg-cyan-400"
                       : livesPercentage > 25
                         ? "bg-amber-500"
                         : "bg-mission-danger"
                   }`}
                   style={{ width: `${livesPercentage}%` }}
                 />
               </div>
               
               <div className="flex items-center gap-1.5">
                  {Array.from({ length: maxLivesToRender }).map((_, i) => (
                    <div key={i}>
                      {i < safeLives ? (
                        <Heart size={24} className="text-mission-danger fill-mission-danger drop-shadow-[0_0_8px_rgba(255,87,87,0.4)]" />
                      ) : (
                        <HeartOff size={24} className="text-mission-panel-elevated fill-mission-panel-elevated border-mission-border" />
                      )}
                    </div>
                  ))}
                  {livesOverflow > 0 && (
                     <div className="ml-2 text-sm font-bold text-mission-secondary-text">
                        +{livesOverflow} more
                     </div>
                  )}
               </div>
            </div>

            {!activeMeeting && (
               <div className="bg-mission-panel-elevated border border-mission-border/50 rounded-lg p-3">
                  <p className="text-xs text-mission-secondary-text flex items-center gap-2">
                     <AlertTriangle size={14} className="text-amber-500" />
                     No active meeting. The displayed lives belong to the most recent available session state.
                  </p>
               </div>
            )}
         </Panel>

         {/* Permanent Points */}
         <Panel className="col-span-1 p-6 flex flex-col justify-between border-mission-border/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-radar-green opacity-80" />
            <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-radar-green/10 border border-radar-green/20 flex items-center justify-center text-radar-green">
                  <Star size={20} />
               </div>
               <div>
                  <h3 className="text-white font-bold font-display tracking-tight">Total Points</h3>
                  <p className="text-sm text-mission-secondary-text">Cumulative balance.</p>
               </div>
            </div>
            
            <div className="mb-6">
               <div className="text-4xl font-mono font-bold text-radar-green tracking-tight">
                 {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
               </div>
               <div className="text-sm text-mission-muted-text mt-1">Permanent points</div>
            </div>

            <div className="bg-mission-bg-secondary border border-mission-border/50 rounded-lg p-3">
               <p className="text-xs text-mission-secondary-text leading-relaxed">
                  Mission Points remain saved across meetings.
               </p>
            </div>
         </Panel>
      </div>

      {/* Achievements Section */}
      <div>
         <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
               <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-display font-bold text-white tracking-tight">Achievements</h2>
                  <span className="bg-mission-panel border border-mission-border/50 text-mission-secondary-text text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {achievements.length} UNLOCKED
                  </span>
               </div>
               <p className="text-sm text-mission-secondary-text">Milestones and special recognitions earned.</p>
            </div>
            
            <Button
              variant="secondary"
              onClick={() => setIsAwardModalOpen(true)}
              className="border-amber-400/30 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400"
            >
              <Award size={16} className="mr-2" />
              Award Recognition
            </Button>
         </div>

         {achievements.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No Achievements Yet"
              description="This student hasn't unlocked any achievements or received special recognition."
            />
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((ach) => (
                <AchievementCard key={ach.id} achievement={ach} />
              ))}
            </div>
         )}
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

// Helper for display
function allStudentsCountPlaceholder(rank: number, classroom: Classroom) {
   return rank > 0 ? "class" : "all";
}

