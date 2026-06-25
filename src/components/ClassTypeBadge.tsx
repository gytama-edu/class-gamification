import React from 'react';
import { Users, User } from 'lucide-react';
import { ClassType, getClassTypeLabel } from '../lib/types/database';

interface ClassTypeBadgeProps {
  type: ClassType | string | null | undefined;
  compact?: boolean;
}

export const ClassTypeBadge: React.FC<ClassTypeBadgeProps> = ({ type, compact = false }) => {
  const isPrivate = type === 'private';
  const label = getClassTypeLabel(type);

  const baseClasses = "inline-flex items-center gap-1.5 rounded-full font-medium border";
  const sizeClasses = compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  
  const colorClasses = isPrivate 
    ? "bg-amber-400/10 text-amber-400 border-amber-400/20" 
    : "bg-cyan-400/10 text-cyan-400 border-cyan-400/20";

  return (
    <span className={`${baseClasses} ${sizeClasses} ${colorClasses}`} title={label}>
      {isPrivate ? <User size={compact ? 10 : 12} /> : <Users size={compact ? 10 : 12} />}
      {label}
    </span>
  );
};
