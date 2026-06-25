import React from 'react';
import { Rocket } from 'lucide-react';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({ eyebrow, title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-mission-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIC8+Cjwvc3ZnPg==')] opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-radar-green/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="w-16 h-16 bg-mission-panel border border-mission-border/50 rounded-2xl flex items-center justify-center shadow-lg mb-6 relative overflow-hidden">
             <div className="absolute inset-0 bg-radar-green/10" />
             <Rocket size={32} className="text-radar-green relative z-10" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight text-center">
            Mission Control
          </h1>
        </div>

        <div className="bg-mission-panel border border-mission-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-700 delay-100">
          <div className="h-1 w-full bg-gradient-to-r from-radar-green via-cyan-400 to-amber-400 opacity-80" />
          <div className="p-8">
            <div className="mb-8">
              <p className="text-xs font-bold text-mission-muted-text uppercase tracking-wider mb-2">
                {eyebrow}
              </p>
              <h2 className="text-2xl font-display font-bold text-white mb-2 tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-mission-secondary-text leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
