import React from "react";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, action, className = "" }) => {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-xs sm:text-sm text-mission-secondary-text mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
