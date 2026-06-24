import React from 'react';
import { RealtimeStatus } from '../lib/realtime/useClassroomRealtime';

interface ConnectionStatusProps {
  status: RealtimeStatus;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status }) => {
  if (status === 'Live') {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-radar-green bg-radar-green/10 px-2 py-1 rounded-full border border-radar-green/20">
        <div className="w-2 h-2 rounded-full bg-radar-green animate-pulse"></div>
        Live
      </div>
    );
  }

  if (status === 'Connecting' || status === 'Reconnecting') {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-mission-warning bg-mission-warning/10 px-2 py-1 rounded-full border border-mission-warning/20">
        <div className="w-2 h-2 rounded-full border-2 border-mission-warning border-t-transparent animate-spin"></div>
        {status}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-mission-danger bg-mission-danger/10 px-2 py-1 rounded-full border border-mission-danger/20">
      <div className="w-2 h-2 rounded-full bg-mission-danger"></div>
      Offline
    </div>
  );
};
