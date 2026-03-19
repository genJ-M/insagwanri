import {
  IsEmail, IsEnum, IsOptional, IsString,
  MinLength, MaxLength, IsDateString,
} from 'class-validator';
import { UserRole } from '../../../common/types/jwt-payload.type';

export class InviteUserDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsEnum([UserRole.MANAGER, UserRole.EMPLOYEE])
  role: UserRole.MANAGER | UserRole.EMPLOYEE;
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
}

export class UpdateRoleDto {
  @IsEnum([UserRole.MANAGER, UserRole.EMPLOYEE])
  role: UserRole.MANAGER | UserRole.EMPLOYEE;
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
