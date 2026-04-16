import { IsString, IsOptional, IsBoolean, IsInt, IsNotEmpty, MaxLength, Min } from 'class-validator';

export class UpsertBlockDto {
  @IsString() @IsNotEmpty() @MaxLength(80)  section: string;
  @IsString() @IsNotEmpty() @MaxLength(80)  key: string;
  @IsString() @IsOptional() @MaxLength(200) label?: string;
  @IsString() @IsNotEmpty()                 value: string;
}

export class BulkUpsertBlocksDto {
  blocks: UpsertBlockDto[];
}

export class CreateBannerDto {
  @IsString() @IsNotEmpty()                text: string;
  @IsString() @IsOptional()                linkUrl?: string;
  @IsString() @IsOptional() @MaxLength(100) linkText?: string;
  @IsString() @IsOptional() @MaxLength(30)  bgColor?: string;
  @IsString() @IsOptional() @MaxLength(30)  textColor?: string;
  @IsOptional()                            isActive?: boolean;
  @IsOptional()                            startsAt?: string;
  @IsOptional()                            endsAt?: string;
}

export class UpdateBannerDto {
  @IsString() @IsOptional()                text?: string;
  @IsString() @IsOptional()                linkUrl?: string;
  @IsString() @IsOptional() @MaxLength(100) linkText?: string;
  @IsString() @IsOptional() @MaxLength(30)  bgColor?: string;
  @IsString() @IsOptional() @MaxLength(30)  textColor?: string;
  @IsOptional()                            isActive?: boolean;
  @IsOptional()                            startsAt?: string;
  @IsOptional()                            endsAt?: string;
}

export class CreatePopupDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty()                 body: string;
  @IsString() @IsOptional() @MaxLength(80)  ctaText?: string;
  @IsString() @IsOptional()                 ctaUrl?: string;
  @IsString() @IsOptional() @MaxLength(30)  triggerType?: string;
  @IsInt()    @IsOptional() @Min(0)         triggerValue?: number;
  @IsString() @IsOptional() @MaxLength(30)  target?: string;
  @IsInt()    @IsOptional() @Min(0)         dismissDays?: number;
  @IsOptional()                             isActive?: boolean;
  @IsOptional()                             startsAt?: string;
  @IsOptional()                             endsAt?: string;
}

export class UpdatePopupDto {
  @IsString() @IsOptional() @MaxLength(100) name?: string;
  @IsString() @IsOptional() @MaxLength(200) title?: string;
  @IsString() @IsOptional()                 body?: string;
  @IsString() @IsOptional() @MaxLength(80)  ctaText?: string;
  @IsString() @IsOptional()                 ctaUrl?: string;
  @IsString() @IsOptional() @MaxLength(30)  triggerType?: string;
  @IsInt()    @IsOptional() @Min(0)         triggerValue?: number;
  @IsString() @IsOptional() @MaxLength(30)  target?: string;
  @IsInt()    @IsOptional() @Min(0)         dismissDays?: number;
  @IsOptional()                             isActive?: boolean;
  @IsOptional()                             startsAt?: string;
  @IsOptional()                             endsAt?: string;
}
