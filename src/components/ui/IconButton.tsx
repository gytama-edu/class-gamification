import React from "react";
import { Loader2 } from "lucide-react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className = "", variant = "ghost", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-border-focus disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      primary: "bg-radar-green hover:bg-radar-green/90 text-mission-bg shadow-sm",
      secondary: "bg-mission-panel-strong hover:bg-mission-panel-elevated text-white border border-mission-border",
      ghost: "hover:bg-mission-panel-strong text-mission-secondary-text hover:text-white",
      danger: "hover:bg-mission-danger/20 text-mission-danger",
    };

    const sizes = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
