import React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  contextLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, contextLabel, action, className = "" }) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8 ${className}`}>
      <div>
        {contextLabel && (
          <span className="text-xs font-bold font-sans text-radar-green uppercase tracking-wider mb-1.5 block opacity-90">
            {contextLabel}
          </span>
        )}
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight drop-shadow-sm">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-mission-secondary-text mt-1.5 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};
