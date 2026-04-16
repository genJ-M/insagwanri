import {
  IsEnum, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { SwapType } from '../../../database/entities/shift-swap-request.entity';

/** 교환 신청 생성 */
export class CreateSwapRequestDto {
  /** swap | cover */
  @IsEnum(SwapType)
  type: SwapType;

  /** 내가 내놓는 시프트 ID */
  @IsUUID()
  requesterAssignmentId: string;

  /** swap 시: 상대방 user ID */
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  /** swap 시: 상대방 시프트 ID */
  @IsOptional()
  @IsUUID()
  targetAssignmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  requesterNote?: string;
}

/** 상대방(B) 응답 (수락/거절) */
export class PeerRespondDto {
  accept: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  peerNote?: string;
}

/** 대타 자원 */
export class VolunteerDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  peerNote?: string;
}

/** 업주 승인/거절 */
export class ApproveRejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  approverNote?: string;
}

/** 목록 조회 필터 */
export class SwapQueryDto {
  @IsOptional()
  @IsString()
  status?: string;   // 콤마 구분 복수 가능
}
