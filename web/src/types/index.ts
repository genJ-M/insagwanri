// ─────────────────────────────────────────
// Auth
// ─────────────────────────────────────────
export type UserRole = 'owner' | 'manager' | 'employee';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
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
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate: string;
  creator: { id: string; name: string };
  assignee: { id: string; name: string; department: string } | null;
  createdAt: string;
  reports?: TaskReport[];
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
