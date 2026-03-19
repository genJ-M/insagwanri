import {
  IsBoolean, IsIn, IsOptional, IsString, Matches,
  IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;
}

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushTask?: boolean;

  @IsOptional()
  @IsBoolean()
  pushMessage?: boolean;

  @IsOptional()
  @IsBoolean()
  pushSchedule?: boolean;

  @IsOptional()
  @IsBoolean()
  pushAttendance?: boolean;

  @IsOptional()
  @IsBoolean()
  emailTask?: boolean;

  @IsOptional()
  @IsBoolean()
  emailWeeklyReport?: boolean;

  @IsOptional()
  @IsBoolean()
  dndEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):[0-5]\d$/, { message: 'HH:MM 형식으로 입력하세요' })
  dndStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):[0-5]\d$/, { message: 'HH:MM 형식으로 입력하세요' })
  dndEndTime?: string;
}

export class RegisterDeviceTokenDto {
  @IsString()
  token: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
