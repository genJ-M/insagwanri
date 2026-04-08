import {
  IsString, IsOptional, IsIn, IsEmail, IsNumber,
  Min, Max, MinLength, MaxLength, IsDateString,
} from 'class-validator';

export class CreateInviteLinkDto {
  /** 링크 종류: personal(1인 전용) | group(다수) */
  @IsIn(['personal', 'group'])
  link_kind: string;

  /** 부여할 역할 */
  @IsIn(['employee', 'manager'])
  role: string;

  /** 개인 링크: 해당 이메일만 사용 가능 (선택) */
  @IsOptional() @IsEmail()
  target_email?: string;

  /** 사전 지정 부서 (선택) */
  @IsOptional() @IsString() @MaxLength(100)
  department?: string;

  /** 사전 지정 직책 (선택) */
  @IsOptional() @IsString() @MaxLength(100)
  position?: string;

  /** 그룹 링크 최대 사용 횟수 (null = 무제한) */
  @IsOptional() @IsNumber() @Min(1) @Max(500)
  max_uses?: number;

  /** 만료 일시 (ISO8601, 기본: 7일 후) */
  @IsOptional() @IsDateString()
  expires_at?: string;

  /** 관리자 내부 메모 */
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class JoinViaLinkDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8) @MaxLength(100)
  password: string;
}
