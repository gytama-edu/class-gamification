import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Star,
  LogOut,
  Loader2,
  Trophy,
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
import {
  DbStudent,
  Classroom,
  Meeting,
  StudentAchievement,
} from "../lib/types/database";
import { useClassroomRealtime } from "../lib/realtime/useClassroomRealtime";

import { useAuth } from "../lib/auth/AuthContext";
import { supabase } from "../lib/supabase/client";

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
      <div className="min-h-screen bg-mission-bg text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-radar-green" size={48} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-mission-bg text-white flex flex-col items-center justify-center p-4">
        <p className="text-mission-danger mb-4">
          {error || "Failed to load data"}
        </p>
        <button
          onClick={handleLeave}
          className="px-6 py-2 bg-mission-panel border border-mission-border rounded-lg hover:bg-mission-bg"
        >
          Return to Join Page
        </button>
      </div>
    );
  }

  const { student, classroom, activeMeeting, lives_remaining, rank } = data;
  const isMeetingLive = activeMeeting !== null;
  // If the meeting has ended (we check current_meeting_number vs the latest meeting)
  // Actually, wait, if there's no active meeting, it could be waiting or complete.
  // We can just say "Meeting Complete" if there was a meeting before, but for simplicity:
  const statusMessage = isMeetingLive
    ? "Meeting Live"
    : classroom.current_meeting_number > 0
      ? "Meeting Complete / Waiting for the next meeting"
      : "Waiting for the first meeting";

  return (
    <div className="min-h-screen bg-mission-bg text-white flex flex-col items-center justify-start p-4 relative overflow-hidden font-sans pt-12 pb-24">
      {/* Top Bar */}
      <div className="w-full max-w-md flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {student.display_name}
          </h1>
          <p className="text-sm text-mission-secondary-text">
            {classroom.name} • {classroom.level_name}
          </p>
        </div>
        <button
          onClick={handleLeave}
          className="p-2 text-mission-muted-text hover:text-white bg-mission-panel border border-mission-border rounded-lg"
          title="Leave Session"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Status Card */}
        <div
          className={`p-4 rounded-2xl border ${isMeetingLive ? "bg-radar-green/10 border-radar-green/30" : "bg-mission-bg-secondary border-mission-border"} flex items-center justify-center gap-2`}
        >
          {isMeetingLive && (
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-radar-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-radar-green"></span>
            </span>
          )}
          <span
            className={`font-medium ${isMeetingLive ? "text-radar-green" : "text-mission-secondary-text"}`}
          >
            {statusMessage}
          </span>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Lives */}
          <div className="bg-mission-panel border border-mission-border p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-mission-danger" />
            <Heart
              size={32}
              className={`mb-2 ${isMeetingLive ? "text-mission-danger fill-mission-danger animate-pulse" : "text-mission-muted-text"}`}
            />
            <span className="text-xs text-mission-muted-text uppercase tracking-wider font-bold mb-1">
              Lives
            </span>
            <div className="text-4xl font-black text-white">
              {isMeetingLive ? (Number.isFinite(Number(lives_remaining)) ? Number(lives_remaining) : 0) : classroom.max_lives}
              <span className="text-xl text-mission-muted-text">
                /{classroom.max_lives}
              </span>
            </div>
          </div>

          {/* Points */}
          <div className="bg-mission-panel border border-mission-border p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-radar-green" />
            <Star
              size={32}
              className="mb-2 text-radar-green fill-radar-green"
            />
            <span className="text-xs text-mission-muted-text uppercase tracking-wider font-bold mb-1">
              Points
            </span>
            <div className="text-4xl font-black text-white">
              {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Rank Card */}
        <div className="bg-mission-panel border border-mission-border p-6 rounded-2xl flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-radar-green/10 flex items-center justify-center border border-radar-green/20">
              <Trophy size={24} className="text-radar-green" />
            </div>
            <div>
              <h3 className="text-mission-secondary-text text-sm font-medium">
                Class Rank
              </h3>
              <p className="text-2xl font-bold text-white">#{rank}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-mission-muted-text">Keep going!</span>
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-mission-panel border border-mission-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-mission-border bg-mission-background/50 flex items-center gap-3">
            <Award className="text-radar-green" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              Achievements
            </h2>
            <span className="ml-auto bg-radar-green/10 text-radar-green text-xs font-bold px-2 py-1 rounded">
              {achievements.length} UNLOCKED
            </span>
          </div>
          <div className="p-4">
            {achievements.length === 0 ? (
              <div className="text-center py-8">
                <Award className="mx-auto text-mission-border mb-3" size={32} />
                <p className="text-mission-muted-text">
                  No achievements unlocked yet.
                </p>
                <p className="text-xs text-mission-muted-text mt-1">
                  Keep participating to earn your first badge!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements.map((ach) => {
                  const Icon = IconMap[ach.icon_key_snapshot] || Award;
                  const tierColor =
                    ach.tier_snapshot === "Platinum"
                      ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
                      : ach.tier_snapshot === "Gold"
                        ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                        : ach.tier_snapshot === "Silver"
                          ? "text-gray-300 bg-gray-300/10 border-gray-300/20"
                          : ach.tier_snapshot === "Special"
                            ? "text-purple-400 bg-purple-400/10 border-purple-400/20"
                            : "text-amber-600 bg-amber-600/10 border-amber-600/20"; // Bronze

                  return (
                    <div
                      key={ach.id}
                      className="flex gap-3 p-3 rounded-xl bg-mission-background border border-mission-border"
                    >
                      <div
                        className={`w-12 h-12 rounded-lg flex flex-shrink-0 items-center justify-center border ${tierColor}`}
                      >
                        <Icon size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-white truncate">
                            {ach.achievement_name_snapshot}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${tierColor}`}
                          >
                            {ach.tier_snapshot}
                          </span>
                        </div>
                        <p className="text-xs text-mission-muted-text mt-0.5 line-clamp-2">
                          {ach.achievement_description_snapshot}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
