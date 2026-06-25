import React from "react";
import { Panel } from "./Panel";

export interface StatCardProps {
  label?: string;
  title?: string; // support both
  value: React.ReactNode;
  icon?: React.ElementType;
  detail?: string;
  trend?: string; // support both
  valueColor?: "default" | "success" | "warning" | "danger" | "info" | string;
  accentColor?: string;
  iconColor?: string;
  bgColor?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  title,
  value, 
  icon: Icon, 
  detail, 
  trend,
  valueColor = "default",
  accentColor = "border-mission-border/50",
  iconColor = "text-mission-muted-text",
  bgColor = "bg-mission-bg-secondary",
  className = "" 
}) => {
  const valueColors: Record<string, string> = {
    default: "text-white",
    success: "text-radar-green",
    warning: "text-amber-500",
    danger: "text-mission-danger",
    info: "text-cyan-400",
  };

  const displayLabel = title || label;
  const displayDetail = trend || detail;
  const resolvedValueColor = valueColors[valueColor] || valueColor; // fallback to custom class if provided

  return (
    <Panel className={`p-5 flex flex-col justify-between border-t-2 relative overflow-hidden ${className} ${accentColor.replace('border-', 'border-t-')}`}>
      <div className="absolute top-0 left-0 w-full h-1 opacity-80" />
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-sm font-medium text-mission-secondary-text mb-1 block">{displayLabel}</span>
          <span className={`text-2xl sm:text-3xl font-mono font-bold ${resolvedValueColor}`}>
            {value}
          </span>
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgColor} ${iconColor} border ${accentColor}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {displayDetail && (
        <div className="text-xs text-mission-muted-text">
          {displayDetail}
        </div>
      )}
    </Panel>
  );
};
