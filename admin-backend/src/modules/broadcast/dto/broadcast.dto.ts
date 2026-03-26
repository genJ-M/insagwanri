import { IsString, IsIn, IsArray, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class CreateBroadcastDto {
  /** 수신 대상: all=전체, plan=플랜별, companies=특정 회사 */
  @IsIn(['all', 'plan', 'companies'])
  target: 'all' | 'plan' | 'companies';

  /** target=plan 일 때 플랜명 (free, basic, pro 등) */
  @IsOptional()
  @IsString()
  planName?: string;

  /** target=companies 일 때 대상 회사 ID 목록 */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  companyIds?: string[];

  /** 발송 채널: in_app=앱 내 알림, email=이메일, both=둘 다 */
  @IsIn(['in_app', 'email', 'both'])
  channel: 'in_app' | 'email' | 'both';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}
