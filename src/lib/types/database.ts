export type ClassType = "regular" | "private";

export const CLASS_TYPE_LABELS: Record<ClassType, string> = {
  regular: "Regular Class",
  private: "Private Class",
};

export function getClassTypeLabel(type: ClassType | string | null | undefined): string {
  const normalized = normalizeClassType(type);
  return CLASS_TYPE_LABELS[normalized];
}

export function normalizeClassType(type: any): ClassType {
  if (type === "private") return "private";
  return "regular";
}

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
  class_type: ClassType;
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
  task_assignment_id: string | null;
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

export type TaskStatus = 'draft' | 'active' | 'completed' | 'archived';
export type TaskAssignmentScope = 'all_students' | 'selected_students' | 'project_groups';
export type TaskAssignmentStatus = 'assigned' | 'submitted' | 'approved' | 'returned';
export type TaskProjectGroupAssignmentStatus = 'pending' | 'assigned' | 'submitted' | 'returned' | 'approved';

export interface ClassTask {
  id: string;
  class_id: string;
  created_by: string;
  title: string;
  instructions: string;
  due_at: string | null;
  reward_points: number;
  assignment_scope: TaskAssignmentScope;
  status: TaskStatus;
  published_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  class_id: string;
  student_id: string;
  status: TaskAssignmentStatus;
  submission_text: string | null;
  submitted_at: string | null;
  teacher_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  points_awarded: number;
  points_awarded_at: string | null;
  created_at: string;
  updated_at: string;
  project_group_assignment_id?: string | null;
  source_project_group_id?: string | null;
  source_group_name_snapshot?: string | null;
  source_group_color_key_snapshot?: ProjectGroupColorKey | null;
}

export type ProjectGroupStatus = 'active' | 'archived';
export type ProjectGroupColorKey = 'green' | 'cyan' | 'blue' | 'purple' | 'amber' | 'rose';

export interface ProjectGroup {
  id: string;
  class_id: string;
  created_by: string;
  name: string;
  description: string;
  color_key: ProjectGroupColorKey;
  display_order: number;
  status: ProjectGroupStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ProjectGroupMembership {
  id: string;
  group_id: string;
  class_id: string;
  student_id: string;
  assigned_by: string;
  assigned_at: string;
  removed_at: string | null;
  removed_by: string | null;
  removal_reason: string | null;
}

export interface ProjectGroupMember {
  student_id: string;
  display_name: string;
}

export interface ProjectGroupWithMembers extends ProjectGroup {
  members: ProjectGroupMember[];
}

export interface ProjectGroupSummary {
  active_groups_count: number;
  assigned_students_count: number;
  unassigned_students_count: number;
  average_group_size: number;
}

export interface CreateProjectGroupInput {
  name: string;
  description: string;
  color_key: ProjectGroupColorKey;
}

export interface UpdateProjectGroupInput {
  name: string;
  description: string;
  color_key: ProjectGroupColorKey;
}

export interface ProjectGroupDistribution {
  groupId: string;
  studentIds: string[];
}

export interface ProjectGroupDistributionResult {
  groupsUpdated: number;
  studentsAssigned: number;
  studentsMoved: number;
}

export interface MyProjectGroup {
  id: string;
  name: string;
  description: string;
  color_key: ProjectGroupColorKey;
  member_names: string[];
}


export interface TaskWithSummary extends ClassTask {
  assigned_count: number;
  submitted_count: number;
  approved_count: number;
  overdue_count: number;
  assigned_group_count?: number;
  submitted_group_count?: number;
  approved_group_count?: number;
  overdue_group_count?: number;
  total_member_count?: number;
}

export interface TaskAssignmentWithStudent extends TaskAssignment {
  student_name: string;
}

export interface StudentTask extends ClassTask {
  assignment: TaskAssignment;
  is_overdue: boolean;
}

export interface CreateTaskInput {
  title: string;
  instructions: string;
  due_at: string | null;
  reward_points: number;
  assignment_scope: TaskAssignmentScope;
  student_ids: string[];
  project_group_ids?: string[];
  publish_immediately: boolean;
}

export interface UpdateTaskInput {
  title: string;
  instructions: string;
  due_at: string | null;
  reward_points: number;
  assignment_scope: TaskAssignmentScope;
  student_ids: string[];
  project_group_ids?: string[];
}

export interface TaskReviewResult {
  assignment: TaskAssignment;
  points_awarded: number;
  student_new_total: number;
}

export interface TaskProjectGroupAssignment {
  id: string;
  task_id: string;
  class_id: string;
  project_group_id: string;
  group_name_snapshot: string | null;
  group_color_key_snapshot: ProjectGroupColorKey | null;
  member_count_snapshot: number | null;
  status: TaskProjectGroupAssignmentStatus;
  submission_text: string | null;
  submitted_at: string | null;
  submitted_by_student_id: string | null;
  submitted_by_name_snapshot: string | null;
  teacher_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reward_points_per_member: number;
  approved_member_count: number;
  snapshot_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskProjectGroupMemberResult {
  student_id: string;
  student_name: string;
  points_awarded: number;
  new_total: number;
}

export interface TaskProjectGroupWithMembers extends TaskProjectGroupAssignment {
  members: ProjectGroupMember[];
}

export interface CreateProjectGroupTaskInput {
  title: string;
  instructions: string;
  due_at: string | null;
  reward_points: number;
  project_group_ids: string[];
  publish_immediately: boolean;
}

export interface UpdateProjectGroupTaskInput {
  title: string;
  instructions: string;
  due_at: string | null;
  reward_points: number;
  project_group_ids: string[];
}

export interface ProjectGroupTaskReviewResult {
  id: string;
  status: TaskProjectGroupAssignmentStatus;
  points_per_member_awarded: number;
  member_count: number;
  total_distributed: number;
  group_name_snapshot: string;
  reviewed_at: string;
  member_results: TaskProjectGroupMemberResult[];
}

export interface StudentProjectGroupTask {
  task_id: string;
  assignment_id: string;
  group_assignment_id: string;
  task_title: string;
  instructions: string;
  due_at: string | null;
  reward_points_per_member: number;
  task_status: TaskStatus;
  group_assignment_status: TaskProjectGroupAssignmentStatus;
  group_name_snapshot: string;
  group_color_key_snapshot: ProjectGroupColorKey;
  submission_text: string | null;
  submitted_at: string | null;
  submitted_by_name_snapshot: string | null;
  teacher_feedback: string | null;
  reviewed_at: string | null;
  student_awarded_points: number;
  member_names_snapshot: string[];
  is_overdue: boolean;
}
