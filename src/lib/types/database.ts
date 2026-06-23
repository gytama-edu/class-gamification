export interface TeacherProfile {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Classroom {
  id: string;
  owner_id: string;
  name: string;
  level_name: string;
  max_lives: number;
  current_meeting_number: number;
  is_archived: boolean;
  join_code: string;
  student_access_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbStudent {
  id: string;
  class_id: string;
  display_name: string;
  avatar_key: string | null;
  total_points: number;
  is_active: boolean;
  student_auth_user_id: string | null;
  access_pin_hash: string | null;
  access_enabled: boolean;
  access_activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  class_id: string;
  meeting_number: number;
  max_lives_snapshot: number;
  status: 'active' | 'completed';
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface StudentMeetingState {
  id: string;
  meeting_id: string;
  student_id: string;
  lives_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface PointEvent {
  id: string;
  class_id: string;
  student_id: string;
  meeting_id: string | null;
  points_delta: number;
  reason: string | null;
  created_at: string;
}

export interface LifeEvent {
  id: string;
  class_id: string;
  student_id: string;
  meeting_id: string;
  lives_delta: number;
  reason: string | null;
  created_at: string;
}

// Combined view types
export interface StudentWithCurrentState extends DbStudent {
  lives_remaining: number;
}

export interface ClassroomDashboardData {
  classroom: Classroom;
  activeMeeting: Meeting | null;
  students: StudentWithCurrentState[];
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  total_points: number;
  lives_remaining: number;
}
