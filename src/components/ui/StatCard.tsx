import React from "react";
import { Panel } from "./Panel";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  detail?: string;
  valueColor?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  value, 
  icon: Icon, 
  detail, 
  valueColor = "default",
  className = "" 
}) => {
  const valueColors = {
    default: "text-white",
    success: "text-mission-success",
    warning: "text-mission-warning",
    danger: "text-mission-danger",
    info: "text-mission-info",
  };

  return (
    <Panel className={`p-4 flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-2 text-mission-muted-text">
        {Icon && <Icon size={14} />}
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl sm:text-3xl font-mono font-bold ${valueColors[valueColor]}`}>
          {value}
        </span>
        {detail && (
          <span className="text-xs font-sans text-mission-secondary-text">
            {detail}
          </span>
        )}
      </div>
    </Panel>
  );
};
