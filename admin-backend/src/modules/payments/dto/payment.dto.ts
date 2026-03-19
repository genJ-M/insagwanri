import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentStatusFilter {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export class PaymentQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsEnum(PaymentStatusFilter)
  status?: PaymentStatusFilter;

  @IsOptional()
  @IsString()
  periodStart?: string; // YYYY-MM

  @IsOptional()
  @IsString()
  periodEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class RefundDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number; // undefined = 전액

  @IsEnum(['full', 'partial', 'adjustment'])
  type: string;
}

export class ManualPaymentDto {
  @IsString()
  companyId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  description: string;

  @IsString()
  reason: string;
}
