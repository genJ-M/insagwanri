import {
  IsEmail, IsEnum, IsOptional, IsString,
  MinLength, MaxLength, IsDateString, IsInt, Min, Max,
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
    canInvite?: boolean;
    canManagePayroll?: boolean;
    canManageContracts?: boolean;
    canManageEvaluations?: boolean;
  } | null;
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
