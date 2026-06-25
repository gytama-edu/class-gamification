import React from 'react';
import { StudentAchievement } from '../lib/types/database';
import { 
  Award, Star, Zap, Crown, Shield, Rocket, Heart, Flag, Users, 
  CalendarCheck, TrendingUp, Trophy, Medal, ShieldCheck, Activity,
  Book, Mic, Brain, Target, HandHeart
} from 'lucide-react';

export const IconMap: Record<string, React.ElementType> = {
  star: Star,
  award: Award,
  zap: Zap,
  crown: Crown,
  shield: Shield,
  rocket: Rocket,
  heart: Heart,
  flag: Flag,
  users: Users,
  'calendar-check': CalendarCheck,
  'trending-up': TrendingUp,
  trophy: Trophy,
  medal: Medal,
  'shield-check': ShieldCheck,
  activity: Activity,
  radio: Activity, // mapped radio to activity if no radio icon
  book: Book,
  microphone: Mic,
  brain: Brain,
  target: Target,
  'helping-hand': HandHeart,
  leadership: Crown,
};

export const getTierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case "bronze":
      return "text-amber-700 bg-amber-700/10 border-amber-700/20";
    case "silver":
      return "text-slate-400 bg-slate-400/10 border-slate-400/20";
    case "gold":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "platinum":
      return "text-teal-100 bg-teal-100/10 border-teal-100/20";
    case "special":
      return "text-radar-green bg-radar-green/10 border-radar-green/20";
    default:
      return "text-mission-muted-text bg-mission-border/30 border-mission-border";
  }
};

export const AchievementIcon: React.FC<{ iconKey: string; className?: string; size?: number }> = ({ iconKey, className, size = 20 }) => {
  const Icon = IconMap[iconKey] || Award;
  return <Icon size={size} className={className} />;
};

interface AchievementCardProps {
  achievement: StudentAchievement;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({ achievement }) => {
  const tierColor = getTierColor(achievement.tier_snapshot);

  return (
    <div
      key={achievement.id}
      className={`bg-mission-bg border rounded-xl p-4 flex gap-4 transition-all duration-300 ${tierColor.split(' ')[2]}`}
    >
      <div
        className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border ${tierColor}`}
      >
        <AchievementIcon iconKey={achievement.icon_key_snapshot} size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-white truncate">
            {achievement.achievement_name_snapshot}
          </h4>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierColor} uppercase tracking-wider whitespace-nowrap`}
          >
            {achievement.tier_snapshot}
          </span>
        </div>
        <p className="text-xs text-mission-muted-text mt-0.5 line-clamp-2">
          {achievement.achievement_description_snapshot}
        </p>
        {achievement.source_type === "manual" && achievement.reason && (
          <p className="text-xs text-radar-green/80 mt-2 italic border-l-2 border-radar-green/30 pl-2">
            "{achievement.reason}"
          </p>
        )}
        <div className="text-[10px] text-mission-muted-text/50 mt-2">
          Earned {new Date(achievement.earned_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};
