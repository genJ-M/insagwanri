// ─────────────────────────────────────────
// Auth
// ─────────────────────────────────────────
export type UserRole = 'owner' | 'manager' | 'employee';

export interface UserPermissions {
  canInvite?: boolean;
  canManagePayroll?: boolean;
  canManageContracts?: boolean;
  canManageEvaluations?: boolean;
  // HR 노트
  canViewHrNotes?: boolean;
  canManageHrNotes?: boolean;
  hrNoteScope?: 'all' | 'managed_departments';
  // 급여
  canViewSalary?: boolean;
  canManageSalary?: boolean;
  salaryScope?: 'all' | 'managed_departments';
  // 위임
  canGrantHrAccess?: boolean;
  canGrantSalaryAccess?: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  department?: string | null;
  permissions?: UserPermissions | null;
  managedDepartments?: string[] | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ─────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────
export type AttendanceStatus =
  | 'pending' | 'normal' | 'late' | 'early_leave'
  | 'absent' | 'half_day' | 'vacation';

export interface AttendanceRecord {
  id: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number | null;
  totalWorkMinutes: number | null;
  user?: { id: string; name: string; department: string };
}

// ─────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string;
  scope: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate: string | null;
  dueDatetime: string | null;         // ISO8601 (날짜+시간)
  templateId: string | null;
  creator: { id: string; name: string };
  assignee: { id: string; name: string; department: string } | null;
  createdAt: string;
  reports?: TaskReport[];
  // 기한 조정 워크플로우
  deletionRequestedAt?: string | null;
  deletionRequesterRole?: string | null;
  timeAdjustStatus: 'pending' | 'approved' | 'rejected' | null;
  timeAdjustProposedDatetime: string | null;
  timeAdjustMessage: string | null;
  timeAdjustRequestedAt: string | null;
}

export interface TaskReport {
  id: string;
  taskId: string;
  content: string;
  progressPercent: number;
  isAiAssisted: boolean;
  feedback: string | null;
  user: { id: string; name: string };
  createdAt: string;
}

// ─────────────────────────────────────────
// Schedule
// ─────────────────────────────────────────
export type ScheduleType =
  | 'general' | 'meeting' | 'vacation'
  | 'business_trip' | 'training' | 'holiday';

export interface Schedule {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  type: ScheduleType;
  color: string;
  targetUserId: string | null;
  creator: { id: string; name: string };
}

// ─────────────────────────────────────────
// Messages
// ─────────────────────────────────────────
export type ChannelType = 'announcement' | 'general' | 'direct' | 'group';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  isPrivate: boolean;
  unreadCount: number;
  lastMessage: {
    content: string;
    createdAt: string;
    userName: string;
  } | null;
}

export interface Message {
  id: string;
  channelId: string;
  content: string;
  contentType: 'text' | 'image' | 'file';
  parentMessageId: string | null;
  isEdited: boolean;
  deletedAt: string | null;
  user: { id: string; name: string; profileImageUrl: string | null };
  createdAt: string;
  // 공지 확인
  confirmedCount?: number;
  totalCount?: number;
  confirmedByMe?: boolean;
  // 공지 대상
  targetType?: 'all' | 'department' | 'custom';
  targetDepartment?: string | null;
  targetUserIds?: string[] | null;
  isPrivateRecipients?: boolean;
  linkedScheduleId?: string | null;
}

export interface MessageRead {
  messageId: string;
  userId: string;
  readAt: string;
  user?: { id: string; name: string; department: string | null; position: string | null };
}

// ─────────────────────────────────────────
// AI
// ─────────────────────────────────────────
export type AiFeature = 'draft' | 'summarize' | 'announcement' | 'schedule_summary' | 'refine';

export interface AiResult {
  id: string;
  feature: AiFeature;
  output_text: string;
  disclaimer: string;
  tokens_used: number;
  model_name: string;
  created_at: string;
  used_count?: number;
  plan_limit?: number;
}

export interface AiHistoryRecord {
  id: string;
  feature: AiFeature;
  output_text: string;
  tokens_used: number;
  model_name: string;
  created_at: string;
}

// ─────────────────────────────────────────
// API 공통 응답
// ─────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

// ─────────────────────────────────────────
// Custom Templates
// ─────────────────────────────────────────
export type CustomTemplateType = 'task' | 'schedule' | 'shift';

export interface CustomTemplate {
  id: string;
  type: CustomTemplateType;
  name: string;
  description: string | null;
  category: string | null;
  fields: Record<string, unknown>;
  isCompanyWide: boolean;
  useCount: number;
  creator: { id: string; name: string };
  createdAt: string;
}

// ─────────────────────────────────────────
// Shift Schedule (팀 근무표)
// ─────────────────────────────────────────
export type ShiftScheduleStatus = 'draft' | 'published';
export type ShiftType = 'office' | 'field_work' | 'remote' | 'overtime' | 'off';

export interface ShiftAssignment {
  id: string;
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  shiftType: ShiftType;
  location: string | null;
  note: string | null;
  isConfirmed: boolean;
  confirmedAt: string | null;
  user: { id: string; name: string; department: string | null; position: string | null };
}

export interface ShiftSchedule {
  id: string;
  title: string;
  department: string | null;
  weekStart: string;
  status: ShiftScheduleStatus;
  note: string | null;
  publishedAt: string | null;
  creator: { id: string; name: string };
  assignments?: ShiftAssignment[];
  createdAt: string;
}

export interface EmployeeAvailability {
  id: string;
  userId: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  note: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
}

export interface TeamAvailabilitySlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  note: string | null;
}

export interface TeamMemberAvailability {
  user: { id: string; name: string; department: string | null; position: string | null };
  availability: Record<string, TeamAvailabilitySlot[]>;
}
