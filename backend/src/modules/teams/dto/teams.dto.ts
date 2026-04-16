import { IsString, IsOptional, IsUUID, IsArray, IsIn, MaxLength, Matches } from 'class-validator';
import { MembershipType } from '../../../database/entities/team-member.entity';

export class CreateTeamDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** 팀 대표 색상 #RRGGBB */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (#RRGGBB)' })
  color?: string;

  /** 초기 팀원 user ID 목록 */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds?: string[];

  /** 팀장 user ID */
  @IsOptional()
  @IsUUID()
  leaderId?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (#RRGGBB)' })
  color?: string;
}

export class AddTeamMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsIn(['primary', 'secondary', 'tf', 'dispatch'])
  membershipType?: MembershipType;
}

export class SetTeamLeaderDto {
  @IsUUID()
  userId: string;
}
