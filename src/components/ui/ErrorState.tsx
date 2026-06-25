import React from "react";
import { AlertCircle } from "lucide-react";
import { Panel } from "./Panel";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  title = "Something went wrong", 
  message, 
  onRetry,
  className = "" 
}) => {
  return (
    <Panel className={`p-6 border-mission-danger/30 bg-mission-danger/5 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="text-mission-danger mt-0.5 flex-shrink-0" size={20} />
        <div>
          <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
          <p className="text-sm text-mission-secondary-text mb-4">{message}</p>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
};
