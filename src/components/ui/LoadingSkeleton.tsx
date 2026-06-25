import React from "react";
import { Panel } from "./Panel";

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`animate-pulse bg-mission-panel-strong rounded ${className}`} />
);

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 w-full">
      <Skeleton className="h-8 w-1/3 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Panel key={i} className="p-4 h-32 flex flex-col justify-between">
            <Skeleton className="h-5 w-1/2" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
};
