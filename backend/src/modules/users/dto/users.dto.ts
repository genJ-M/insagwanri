import {
  IsEmail, IsEnum, IsOptional, IsString, IsBoolean,
  MinLength, MaxLength, IsDateString, IsInt, Min, Max,
  IsUUID, IsArray, IsIn,
} from 'class-validator';
import { UserRole } from '../../../common/types/jwt-payload.type';

export class InviteUserDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsEnum([UserRole.MANAGER, UserRole.EMPLOYEE])
  role: UserRole.MANAGER | UserRole.EMPLOYEE;
}

export class InviteByPhoneDto {
  @IsString()
  phone: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsEnum([UserRole.MANAGER, UserRole.EMPLOYEE])
  role: UserRole.MANAGER | UserRole.EMPLOYEE;
}

export class CreateShareableLinkDto {
  @IsOptional()
  @IsEnum([UserRole.MANAGER, UserRole.EMPLOYEE])
  role?: UserRole.MANAGER | UserRole.EMPLOYEE;

  /** 링크 유효 기간 (일, 기본 7일, 최대 30일) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  validDays?: number;

  /** 최대 사용 횟수 (null = 무제한) */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  password: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** 전화번호·링크 초대 시 사용자가 직접 입력하는 이메일 */
  @IsOptional()
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  coverImageMobileUrl?: string | null;

  @IsOptional()
  coverMobileCrop?: { x: number; y: number; width: number; height: number } | null;
}

export class UpdateRoleDto {
  @IsEnum([UserRole.MANAGER, UserRole.EMPLOYEE])
  role: UserRole.MANAGER | UserRole.EMPLOYEE;
}

export class UpdatePermissionsDto {
  /** null = 전체 부서 접근, 배열 = 해당 부서만 */
  @IsOptional()
  managedDepartments?: string[] | null;

  @IsOptional()
  permissions?: {
    // ─ 기존 권한 ─
    canInvite?: boolean;
    canManagePayroll?: boolean;
    canManageContracts?: boolean;
    canManageEvaluations?: boolean;
    // ─ HR 노트 ─
    canViewHrNotes?: boolean;
    canManageHrNotes?: boolean;
    hrNoteScope?: 'all' | 'managed_departments';
    // ─ 급여 ─
    canViewSalary?: boolean;
    canManageSalary?: boolean;
    salaryScope?: 'all' | 'managed_departments';
    // ─ 권한 위임 (소유자만 부여 가능) ─
    canGrantHrAccess?: boolean;
    canGrantSalaryAccess?: boolean;
  } | null;
}

/**
 * 권한 변경 결재 기안 요청 DTO
 * 결재가 완료되면 서버에서 자동으로 대상 직원의 권한을 업데이트합니다.
 */
export class RequestPermissionChangeDto {
  /** 권한 변경 대상 직원 ID */
  @IsUUID()
  target_user_id: string;

  /** 변경할 권한 내용 (null = 해당 권한 제거) */
  @IsOptional()
  permissions?: {
    canViewHrNotes?: boolean;
    canManageHrNotes?: boolean;
    hrNoteScope?: 'all' | 'managed_departments';
    canViewSalary?: boolean;
    canManageSalary?: boolean;
    salaryScope?: 'all' | 'managed_departments';
    canInvite?: boolean;
    canManageContracts?: boolean;
    canManageEvaluations?: boolean;
  };

  /** 변경할 담당 부서 범위 (null = 전체 부서) */
  @IsOptional()
  managedDepartments?: string[] | null;

  /** 결재 요청 사유 (필수) */
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;

  /** 결재선: 결재자 ID 목록 (순서대로 step 1, 2, ...) */
  @IsArray()
  @IsUUID('4', { each: true })
  approver_ids: string[];
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UserQueryDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 개인 근무 스케줄 직접 변경 (owner / 위임자 전용)
 * null을 넣으면 회사 기본값으로 리셋
 */
export class UpdateWorkScheduleDto {
  /** 출근 시간 (HH:mm). null → 회사 기본값 사용 */
  @IsOptional()
  @IsString()
  workStartTime?: string | null;

  /** 퇴근 시간 (HH:mm). null → 회사 기본값 사용 */
  @IsOptional()
  @IsString()
  workEndTime?: string | null;

  /**
   * 휴게시간(분). null → 법정 최소 자동 계산
   * 법정 기준: 4h이상 30분, 8h이상 60분 (근로기준법 제54조)
   * 법정 최소보다 적게 설정할 수 없음
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  breakMinutes?: number | null;

  /** 지각 허용 시간(분). null → 회사 설정 사용 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  lateThresholdMin?: number | null;

  /** 변경 사유 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * 근무 스케줄 변경 결재 기안 (manager 이하)
 * 결재 완료 시 자동으로 개인 스케줄에 반영됨
 */
export class RequestWorkScheduleChangeDto {
  /** 대상 직원 ID */
  @IsUUID()
  targetUserId: string;

  @IsOptional()
  @IsString()
  workStartTime?: string | null;

  @IsOptional()
  @IsString()
  workEndTime?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  breakMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  lateThresholdMin?: number | null;

  /** 변경 사유 (결재 문서에 표시됨) */
  @IsString()
  @MaxLength(1000)
  reason: string;

  /** 결재선: 결재자 ID 목록 (순서대로 step 1, 2, ...) */
  @IsArray()
  @IsUUID('4', { each: true })
  approver_ids: string[];
}
