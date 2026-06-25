import React from 'react';
import { Users, User } from 'lucide-react';
import { ClassType } from '../lib/types/database';

interface ClassTypeSelectorProps {
  value: ClassType;
  onChange: (value: ClassType) => void;
  disabled?: boolean;
  error?: string;
  compact?: boolean;
}

export const ClassTypeSelector: React.FC<ClassTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  error,
  compact = false,
}) => {
  return (
    <div className="space-y-3" role="radiogroup" aria-labelledby="class-type-label">
      <div id="class-type-label" className="sr-only">Select Class Category</div>
      
      <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {/* Regular Class Option */}
        <label 
          className={`
            relative flex flex-col p-4 cursor-pointer rounded-xl border transition-all
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-mission-border hover:bg-mission-panel-elevated'}
            ${value === 'regular' 
              ? 'border-cyan-400 bg-cyan-400/5 ring-1 ring-cyan-400 shadow-sm' 
              : 'border-mission-border/50 bg-mission-bg'}
          `}
        >
          <input 
            type="radio" 
            name="class_type" 
            value="regular" 
            checked={value === 'regular'} 
            onChange={() => onChange('regular')}
            disabled={disabled}
            className="sr-only"
            aria-label="Regular Class"
          />
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${value === 'regular' ? 'bg-cyan-400/10 text-cyan-400' : 'bg-mission-panel-strong text-mission-secondary-text'}`}>
              <Users size={18} />
            </div>
            <div className={`font-semibold ${value === 'regular' ? 'text-cyan-400' : 'text-white'}`}>
              Regular Class
            </div>
          </div>
          {!compact && (
            <p className="text-xs text-mission-secondary-text mt-1 pl-11">
              Designed for classes with multiple students and recurring meetings.
            </p>
          )}
        </label>

        {/* Private Class Option */}
        <label 
          className={`
            relative flex flex-col p-4 cursor-pointer rounded-xl border transition-all
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-mission-border hover:bg-mission-panel-elevated'}
            ${value === 'private' 
              ? 'border-amber-400 bg-amber-400/5 ring-1 ring-amber-400 shadow-sm' 
              : 'border-mission-border/50 bg-mission-bg'}
          `}
        >
          <input 
            type="radio" 
            name="class_type" 
            value="private" 
            checked={value === 'private'} 
            onChange={() => onChange('private')}
            disabled={disabled}
            className="sr-only"
            aria-label="Private Class"
          />
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${value === 'private' ? 'bg-amber-400/10 text-amber-400' : 'bg-mission-panel-strong text-mission-secondary-text'}`}>
              <User size={18} />
            </div>
            <div className={`font-semibold ${value === 'private' ? 'text-amber-400' : 'text-white'}`}>
              Private Class
            </div>
          </div>
          {!compact && (
            <p className="text-xs text-mission-secondary-text mt-1 pl-11">
              Designed for individual tutoring or small private sessions.
            </p>
          )}
        </label>
      </div>
      {error && <p className="text-mission-danger text-xs mt-1">{error}</p>}
    </div>
  );
};
