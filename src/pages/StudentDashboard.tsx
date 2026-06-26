import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Star,
  LogOut,
  Trophy,
  Award,
  Radio,
  ListTodo,
  ChevronRight
} from "lucide-react";
import { getRepository } from "../lib/data/repository";
import {
  DbStudent,
  Classroom,
  Meeting,
  StudentAchievement,
  StudentTask,
  StudentProjectGroupTask
} from "../lib/types/database";
import { useClassroomRealtime } from "../lib/realtime/useClassroomRealtime";

import { useAuth } from "../lib/auth/AuthContext";
import { supabase } from "../lib/supabase/client";
import { AchievementCard } from "../components/AchievementCard";
import { Panel, StatCard, LoadingSkeleton } from "../components/ui";
import { ClassTypeBadge } from "../components/ClassTypeBadge";

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [data, setData] = useState<{
    student: DbStudent;
    classroom: Classroom;
    activeMeeting: Meeting | null;
    lives_remaining: number;
    rank: number;
  } | null>(null);
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [groupTasks, setGroupTasks] = useState<StudentProjectGroupTask[]>([]);
  const [projectGroup, setProjectGroup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const studentId = localStorage.getItem("gytama_student_id");

  const loadData = useCallback(async () => {
    if (!studentId) {
      navigate("/join");
      return;
    }
    try {
      const repo = getRepository();
      const dashboardData = await repo.getStudentDashboard(studentId);
      if (!dashboardData) {
        throw new Error("Could not load student dashboard.");
      }
      setData(dashboardData);

      const achs = await repo.getStudentAchievements(studentId);
      setAchievements(achs);
      
      const studentTasks = await repo.getStudentTasks(studentId);
      setTasks(studentTasks);
      
      const pGroupTasks = await repo.getMyProjectGroupTasks();
      setGroupTasks(pGroupTasks);
      
      const pg = await repo.getMyProjectGroup();
      setProjectGroup(pg);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load data");
      if (
        err.message?.includes("authorized") ||
        err.message?.includes("incorrect") ||
        err.message?.includes("Could not load")
      ) {
        localStorage.removeItem("gytama_student_id");
        if (supabase) await supabase.auth.signOut();
        navigate("/join");
      }
    } finally {
      setIsLoading(false);
    }
  }, [studentId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useClassroomRealtime(
    data?.classroom.id || null,
    data?.activeMeeting?.id || null,
    loadData,
  );

  const handleLeave = async () => {
    localStorage.removeItem("gytama_student_id");
    if (supabase) {
      await supabase.auth.signOut();
    }
    navigate("/join");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mission-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
           <LoadingSkeleton />
           <div className="grid grid-cols-2 gap-4">
             <LoadingSkeleton />
             <LoadingSkeleton />
           </div>
           <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-mission-bg flex flex-col items-center justify-center p-4">
        <p className="text-mission-danger mb-4 font-medium bg-mission-danger/10 px-4 py-2 rounded-xl border border-mission-danger/20">
          {error || "Failed to load data"}
        </p>
        <button
          onClick={handleLeave}
          className="px-6 py-2.5 bg-mission-panel-elevated border border-mission-border/50 rounded-xl hover:bg-mission-bg text-white font-medium transition-colors shadow-sm"
        >
          Return to Join Page
        </button>
      </div>
    );
  }

  const { student, classroom, activeMeeting, lives_remaining, rank } = data;
  const isMeetingLive = activeMeeting !== null;
  const statusMessage = isMeetingLive
    ? "Meeting Live"
    : classroom.current_meeting_number > 0
      ? "Meeting Complete"
      : "Waiting for first meeting";

  return (
    <div className="min-h-screen bg-mission-bg text-mission-primary-text flex flex-col items-center p-4 font-sans pt-12 pb-24 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <div className="w-full max-w-md flex justify-between items-start mb-8 relative z-10">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-1">
            {student.display_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm font-medium text-mission-secondary-text">
              {classroom.name} • {classroom.level_name}
            </p>
            <ClassTypeBadge type={classroom.class_type} compact />
          </div>
        </div>
        <button
          onClick={handleLeave}
          className="p-2 text-mission-muted-text hover:text-white bg-mission-panel border border-mission-border/50 rounded-xl transition-colors shadow-sm"
          title="Leave Session"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="w-full max-w-md space-y-4 relative z-10 animate-in fade-in duration-500">
        {/* Status Card */}
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 shadow-sm ${isMeetingLive ? "bg-cyan-500/10 border-cyan-500/30" : "bg-mission-panel border-mission-border/50"}`}
        >
          {isMeetingLive ? (
            <span className="relative flex h-2.5 w-2.5 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
            </span>
          ) : (
             <Radio size={14} className="text-mission-muted-text" />
          )}
          <span
            className={`font-mono text-sm font-bold uppercase tracking-wider ${isMeetingLive ? "text-cyan-400" : "text-mission-muted-text"}`}
          >
            {statusMessage}
          </span>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Current Lives"
            value={
              <div className="flex items-baseline gap-1">
                {isMeetingLive ? (Number.isFinite(Number(lives_remaining)) ? Number(lives_remaining) : 0) : classroom.max_lives}
                <span className="text-lg text-mission-muted-text font-normal">/{classroom.max_lives}</span>
              </div>
            }
            icon={Heart}
            trend={isMeetingLive ? "Active session" : "Full lives"}
            accentColor={isMeetingLive ? "border-mission-danger/30" : "border-mission-border/50"}
            iconColor={isMeetingLive ? "text-mission-danger" : "text-mission-muted-text"}
            bgColor={isMeetingLive ? "bg-mission-danger/10" : "bg-mission-bg-secondary"}
            valueColor={isMeetingLive ? "text-white" : "text-white"}
          />

          <StatCard
            title="Total Points"
            value={(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
            icon={Star}
            trend="All time"
            accentColor="border-radar-green/30"
            iconColor="text-radar-green"
            bgColor="bg-radar-green/10"
            valueColor="text-white"
          />
        </div>

        {/* Rank Card */}
        <Panel className="p-5 border-mission-border/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Trophy size={24} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-mission-secondary-text text-sm font-medium mb-0.5">
                Class Rank
              </h3>
              <p className="text-3xl font-mono font-bold text-white leading-none">#{rank}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-mission-muted-text uppercase tracking-wider">Keep<br/>going</span>
          </div>
        </Panel>

        {/* Project Group Card */}
        {projectGroup && (
          <Panel className="p-0 border-mission-border/50 overflow-hidden">
            <div className={`p-4 border-b border-mission-border/50 flex items-center gap-2 ${
              projectGroup.color_key === 'green' ? 'bg-radar-green/10 text-radar-green' :
              projectGroup.color_key === 'cyan' ? 'bg-neon-cyan/10 text-neon-cyan' :
              projectGroup.color_key === 'blue' ? 'bg-mission-blue/10 text-mission-blue' :
              projectGroup.color_key === 'purple' ? 'bg-purple-500/10 text-purple-400' :
              projectGroup.color_key === 'amber' ? 'bg-amber-500/10 text-amber-400' :
              'bg-rose-500/10 text-rose-400'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                projectGroup.color_key === 'green' ? 'bg-radar-green' :
                projectGroup.color_key === 'cyan' ? 'bg-neon-cyan' :
                projectGroup.color_key === 'blue' ? 'bg-mission-blue' :
                projectGroup.color_key === 'purple' ? 'bg-purple-500' :
                projectGroup.color_key === 'amber' ? 'bg-amber-500' :
                'bg-rose-500'
              } shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
              <h2 className="font-display font-bold">
                {projectGroup.name}
              </h2>
            </div>
            <div className="p-4 bg-mission-panel">
              {projectGroup.description && (
                <p className="text-sm text-mission-secondary-text mb-3">
                  {projectGroup.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {projectGroup.member_names?.map((name: string, i: number) => (
                  <span key={i} className="text-xs bg-deep-space border border-mission-border/50 text-white px-2 py-1 rounded">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        )}

        {/* Tasks */}
        <Panel className="p-0 border-mission-border/50 overflow-hidden">
          <div className="p-4 border-b border-mission-border/50 bg-mission-panel-strong flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo className="text-cyan-400" size={18} />
              <h2 className="font-display font-bold text-white">
                My Tasks
              </h2>
            </div>
            {tasks.filter(t => t.assignment.status === 'assigned' || t.assignment.status === 'returned').length + groupTasks.filter(t => t.group_assignment_status === 'assigned' || t.group_assignment_status === 'returned').length > 0 && (
              <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-500/20 uppercase tracking-wider">
                {tasks.filter(t => t.assignment.status === 'assigned' || t.assignment.status === 'returned').length + groupTasks.filter(t => t.group_assignment_status === 'assigned' || t.group_assignment_status === 'returned').length} Action Required
              </span>
            )}
          </div>
          <div className="p-0 bg-mission-panel-elevated/30">
            {tasks.length === 0 && groupTasks.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-xl bg-mission-bg-secondary border border-mission-border/50 flex items-center justify-center mx-auto mb-3">
                   <ListTodo className="text-mission-muted-text" size={24} />
                </div>
                <p className="text-mission-secondary-text text-sm font-medium">
                  No tasks assigned yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-mission-border/50">
                {groupTasks.map((task) => (
                  <button 
                    key={task.task_id} 
                    className="w-full p-4 flex items-center justify-between hover:bg-mission-panel transition-colors text-left group"
                    onClick={() => navigate(`/student/group-tasks/${task.group_assignment_id}`)}
                  >
                    <div>
                      <div className="font-medium text-white group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                        {task.task_title}
                        <span className="bg-purple-500/10 text-purple-400 text-[10px] px-1.5 py-0.5 rounded border border-purple-500/20">Group Task</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {task.group_assignment_status === 'assigned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-bg-secondary text-mission-muted-text">To Do</span>}
                        {task.group_assignment_status === 'submitted' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">Submitted</span>}
                        {task.group_assignment_status === 'approved' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-radar-green/10 text-radar-green">Approved</span>}
                        {task.group_assignment_status === 'returned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-danger/10 text-mission-danger">Returned</span>}
                        
                        {task.reward_points_per_member > 0 && task.group_assignment_status !== 'approved' && (
                          <span className="text-xs text-radar-green">{task.reward_points_per_member} pts</span>
                        )}
                        {task.is_overdue && (
                          <span className="text-xs text-mission-danger">Overdue</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-mission-muted-text group-hover:text-white transition-colors" />
                  </button>
                ))}
                {tasks.map((task) => (
                  <button 
                    key={task.id} 
                    className="w-full p-4 flex items-center justify-between hover:bg-mission-panel transition-colors text-left group"
                    onClick={() => navigate(`/student/tasks/${task.id}`)}
                  >
                    <div>
                      <div className="font-medium text-white group-hover:text-cyan-400 transition-colors">{task.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {task.assignment.status === 'assigned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-bg-secondary text-mission-muted-text">To Do</span>}
                        {task.assignment.status === 'submitted' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">Submitted</span>}
                        {task.assignment.status === 'approved' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-radar-green/10 text-radar-green">Approved</span>}
                        {task.assignment.status === 'returned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-danger/10 text-mission-danger">Returned</span>}
                        
                        {task.reward_points > 0 && task.assignment.status !== 'approved' && (
                          <span className="text-xs text-radar-green">{task.reward_points} pts</span>
                        )}
                        {task.is_overdue && (
                          <span className="text-xs text-mission-danger">Overdue</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-mission-muted-text group-hover:text-white transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* Achievements */}
        <Panel className="p-0 border-mission-border/50 overflow-hidden">
          <div className="p-4 border-b border-mission-border/50 bg-mission-panel-strong flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="text-purple-400" size={18} />
              <h2 className="font-display font-bold text-white">
                Achievements
              </h2>
            </div>
            <span className="bg-purple-400/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-400/20 uppercase tracking-wider">
              {achievements.length} Unlocked
            </span>
          </div>
          <div className="p-4 bg-mission-panel-elevated/30">
            {achievements.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-xl bg-mission-bg-secondary border border-mission-border/50 flex items-center justify-center mx-auto mb-3">
                   <Award className="text-mission-muted-text" size={24} />
                </div>
                <p className="text-mission-secondary-text text-sm font-medium">
                  No achievements unlocked yet.
                </p>
                <p className="text-xs text-mission-muted-text mt-1">
                  Keep participating to earn your first badge!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements.map((ach) => (
                  <AchievementCard key={ach.id} achievement={ach} />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
};

