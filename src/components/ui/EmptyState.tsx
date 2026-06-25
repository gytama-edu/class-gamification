import React from "react";
import { Panel } from "./Panel";

export interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, className = "" }) => {
  return (
    <Panel className={`flex flex-col items-center justify-center p-12 text-center border-dashed border-mission-border-strong bg-mission-bg-secondary/50 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-mission-panel flex items-center justify-center mb-5 text-mission-secondary-text shadow-sm border border-mission-border/50">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-display font-bold text-white mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-mission-secondary-text max-w-sm mb-8 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </Panel>
  );
};
