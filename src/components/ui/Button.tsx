import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-sans font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-border-focus disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      primary: "bg-gradient-to-b from-radar-green to-[#78C74D] hover:from-[#9CF066] hover:to-radar-green text-mission-bg border border-[#A2FB6C]/50 shadow-[0_0_12px_rgba(141,227,93,0.25)] hover:shadow-[0_0_16px_rgba(141,227,93,0.4)]",
      secondary: "bg-mission-panel-elevated hover:bg-mission-panel-strong text-mission-primary-text border border-mission-border hover:border-mission-border-strong shadow-sm",
      ghost: "hover:bg-mission-panel-elevated text-mission-secondary-text hover:text-white transition-colors",
      danger: "bg-mission-danger/10 hover:bg-mission-danger/20 text-mission-danger border border-mission-danger/30 hover:border-mission-danger/50",
    };

    const sizes = {
      sm: "h-8 px-3.5 text-xs rounded-md",
      md: "h-10 px-5 py-2 text-sm rounded-lg",
      lg: "h-12 px-8 text-base rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
