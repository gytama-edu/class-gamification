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
  has_pin?: boolean;
  pin_generated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface Meeting {
  id: string;
  class_id: string;
  meeting_number: number;
  max_lives_snapshot: number;
  class_name_snapshot?: string | null;
  level_name_snapshot?: string | null;
  status: "active" | "completed";
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface StudentMeetingState {
  id: string;
  meeting_id: string;
  student_id: string;
  lives_remaining: number;
  student_name_snapshot?: string | null;
  points_before?: number;
  points_after?: number;
  final_rank?: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingHistoryItem {
  id: string;
  meeting_number: number;
  status: "active" | "completed";
  started_at: string;
  ended_at: string | null;
  participant_count: number;
  points_awarded: number;
  points_deducted: number;
  net_points: number;
  lives_lost: number;
  lives_restored: number;
}

export interface MeetingReportStudent {
  student_id: string;
  student_name: string;
  final_rank: number | null;
  points_before: number;
  points_earned: number;
  points_deducted: number;
  net_points: number;
  points_after: number;
  starting_lives: number;
  lives_lost: number;
  lives_restored: number;
  final_lives: number;
}

export interface MeetingReport {
  meeting: {
    id: string;
    meeting_number: number;
    class_name_snapshot: string;
    level_name_snapshot: string;
    started_at: string;
    ended_at: string | null;
    max_lives_snapshot: number;
    participant_count: number;
    points_awarded: number;
    points_deducted: number;
    net_points: number;
    lives_lost: number;
    lives_restored: number;
  };
  students: MeetingReportStudent[];
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

export interface AchievementDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Special" | string;
  icon_key: string;
  is_active: boolean;
  is_automatic: boolean;
  sort_order: number;
  created_at: string;
}

export interface StudentAchievement {
  id: string;
  class_id: string;
  student_id: string;
  achievement_definition_id: string | null;
  achievement_key_snapshot: string;
  achievement_name_snapshot: string;
  achievement_description_snapshot: string;
  category_snapshot: string;
  tier_snapshot: string;
  icon_key_snapshot: string;
  source_type: string;
  source_meeting_id: string | null;
  awarded_by: string | null;
  reason: string | null;
  earned_at: string;
  created_at: string;
}

export interface AchievementSummary {
  student_id: string;
  achievements: StudentAchievement[];
}

export interface TeacherRecognitionInput {
  title: string;
  reason: string | null;
  iconKey: string;
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
