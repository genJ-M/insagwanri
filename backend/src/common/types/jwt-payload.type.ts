export enum UserRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

export interface JwtPayload {
  sub: string;        // user id
  companyId: string;  // 멀티테넌트 격리 핵심
  role: UserRole;
  email: string;
  /** 단일 기기 세션 강제 — 로그인마다 새 UUID 발급, DB와 불일치 시 즉시 401 */
  sessionId: string;
}

export interface JwtRefreshPayload extends JwtPayload {
  refreshTokenId: string; // refresh token 고유 식별자 (무효화용)
}

/**
 * 세부 권한 플래그 (JSONB 컬럼에 저장)
 * - HR노트: canViewHrNotes / canManageHrNotes / hrNoteScope
 * - 급여:   canViewSalary / canManageSalary / salaryScope
 * - 위임:   canGrantHrAccess / canGrantSalaryAccess
 */
export interface UserPermissions {
  // ─── 기존 권한 (하위 호환 유지) ──────────────
  canInvite?: boolean;
  canManagePayroll?: boolean;       // canManageSalary 와 동의어
  canManageContracts?: boolean;
  canManageEvaluations?: boolean;
  // ─── HR 노트 접근 ─────────────────────────────
  /** 타인의 HR 노트 열람 가능 (비공개 제외) */
  canViewHrNotes?: boolean;
  /** HR 노트 생성·수정·삭제 가능 */
  canManageHrNotes?: boolean;
  /**
   * HR 노트 열람 범위
   * 'all' (기본): 회사 전체 / 'managed_departments': managedDepartments에 속한 직원만
   */
  hrNoteScope?: 'all' | 'managed_departments';
  // ─── 급여 접근 ────────────────────────────────
  /** 타인의 급여 열람 가능 */
  canViewSalary?: boolean;
  /** 급여 생성·수정·확정·지급 가능 */
  canManageSalary?: boolean;
  /**
   * 급여 열람 범위
   * 'all' (기본): 회사 전체 / 'managed_departments': managedDepartments에 속한 직원만
   */
  salaryScope?: 'all' | 'managed_departments';
  // ─── 권한 위임 (소유자만 부여 가능) ──────────
  /** HR 접근 권한(canViewHrNotes/canManageHrNotes)을 타인에게 직접 부여 가능 */
  canGrantHrAccess?: boolean;
  /** 급여 접근 권한(canViewSalary/canManageSalary)을 타인에게 직접 부여 가능 */
  canGrantSalaryAccess?: boolean;
}

// 인증된 요청에 주입되는 사용자 객체
export interface AuthenticatedUser {
  id: string;
  companyId: string;
  role: UserRole;
  email: string;
  name: string;
  department?: string | null;
  managedDepartments?: string[] | null;
  permissions?: UserPermissions | null;
}
