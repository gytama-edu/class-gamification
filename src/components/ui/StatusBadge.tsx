import React from "react";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "offline" | "default";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  children, 
  variant = "default", 
  dot = false,
  className = "",
  ...props 
}) => {
  const variants: Record<StatusVariant, string> = {
    success: "bg-mission-success/10 text-mission-success border-mission-success/20",
    warning: "bg-mission-warning/10 text-mission-warning border-mission-warning/20",
    danger: "bg-mission-danger/10 text-mission-danger border-mission-danger/20",
    info: "bg-mission-info/10 text-mission-info border-mission-info/20",
    offline: "bg-mission-offline/10 text-mission-offline border-mission-offline/20",
    default: "bg-mission-panel text-mission-secondary-text border-mission-border/50 shadow-sm",
  };

  const dotColors: Record<StatusVariant, string> = {
    success: "bg-mission-success",
    warning: "bg-mission-warning",
    danger: "bg-mission-danger",
    info: "bg-mission-info",
    offline: "bg-mission-offline",
    default: "bg-mission-muted-text",
  };

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider border ${variants[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {variant === "success" && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mission-success opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColors[variant]}`}></span>
        </span>
      )}
      {children}
    </span>
  );
};
