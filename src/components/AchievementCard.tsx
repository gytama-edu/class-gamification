import React from 'react';
import { StudentAchievement } from '../lib/types/database';
import { 
  Award, Star, Zap, Crown, Shield, Rocket, Heart, Flag, Users, 
  CalendarCheck, TrendingUp, Trophy, Medal, ShieldCheck, Activity,
  Book, Mic, Brain, Target, HandHeart, Sparkles
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
      return "text-[#CD7F32] bg-[#CD7F32]/10 border-[#CD7F32]/30";
    case "silver":
      return "text-slate-300 bg-slate-300/10 border-slate-300/30";
    case "gold":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "platinum":
      return "text-cyan-300 bg-cyan-300/10 border-cyan-300/30";
    case "special":
      return "text-radar-green bg-radar-green/10 border-radar-green/30";
    default:
      return "text-mission-muted-text bg-mission-border/30 border-mission-border";
  }
};

export const getTierAccentHex = (tier: string) => {
  switch (tier.toLowerCase()) {
    case "bronze": return "#CD7F32";
    case "silver": return "#CBD5E1";
    case "gold": return "#FBBF24";
    case "platinum": return "#67E8F9";
    case "special": return "#23FF53";
    default: return "#475569";
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
  const accentHex = getTierAccentHex(achievement.tier_snapshot);
  
  let formattedDate = 'Unknown Date';
  try {
    if (achievement.earned_at) {
      formattedDate = new Date(achievement.earned_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      if (formattedDate === 'Invalid Date') {
        formattedDate = 'Unknown Date';
      }
    }
  } catch (e) {
    // safe fallback
  }

  return (
    <div
      key={achievement.id}
      className="bg-mission-panel border border-mission-border/50 rounded-xl p-4 flex flex-col relative overflow-hidden group hover:border-mission-border transition-all"
    >
      <div 
        className="absolute top-0 left-0 w-1 h-full opacity-80" 
        style={{ backgroundColor: accentHex }} 
      />
      
      <div className="flex gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${tierColor}`}>
          <AchievementIcon iconKey={achievement.icon_key_snapshot} size={24} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-white truncate">
              {achievement.achievement_name_snapshot}
            </h4>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tierColor} uppercase tracking-wider whitespace-nowrap`}
            >
              {achievement.tier_snapshot}
            </span>
          </div>
          <p className="text-xs text-mission-secondary-text mt-1 line-clamp-2 leading-relaxed">
            {achievement.achievement_description_snapshot}
          </p>
        </div>
      </div>
      
      {achievement.source_type === "manual" && achievement.reason && (
        <div className="mt-3 bg-mission-bg-secondary border border-mission-border/50 rounded-lg p-2.5 flex items-start gap-2">
           <Sparkles size={14} className="text-amber-400 mt-0.5 shrink-0" />
           <p className="text-xs text-mission-secondary-text leading-relaxed">
             <span className="text-white font-medium">Teacher Note:</span> {achievement.reason}
           </p>
        </div>
      )}
      
      <div className="mt-3 text-[10px] text-mission-muted-text flex justify-end">
        Earned {formattedDate}
      </div>
    </div>
  );
};

