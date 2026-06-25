import React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  strong?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className = "", elevated, strong, children, ...props }, ref) => {
    let bg = "bg-mission-panel";
    if (elevated) bg = "bg-mission-panel-elevated shadow-lg shadow-mission-bg/50";
    if (strong) bg = "bg-mission-panel-strong";

    return (
      <div
        ref={ref}
        className={`${bg} border border-mission-border rounded-2xl shadow-sm ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Panel.displayName = "Panel";
