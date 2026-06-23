import React from 'react';
import { RealtimeStatus } from '../lib/realtime/useClassroomRealtime';

interface ConnectionStatusProps {
  status: RealtimeStatus;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status }) => {
  if (status === 'Live') {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        Live
      </div>
    );
  }

  if (status === 'Connecting' || status === 'Reconnecting') {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full border border-amber-400/20">
        <div className="w-2 h-2 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
        {status}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-rose-400 bg-rose-400/10 px-2 py-1 rounded-full border border-rose-400/20">
      <div className="w-2 h-2 rounded-full bg-rose-400"></div>
      Offline
    </div>
  );
};
