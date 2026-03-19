import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum BillingCycleDto {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class UpgradeSubscriptionDto {
  @IsUUID()
  planId: string;

  @IsEnum(BillingCycleDto)
  billingCycle: BillingCycleDto;

  @IsUUID()
  paymentMethodId: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class IssueBillingKeyDto {
  @IsString()
  authKey: string; // Toss SDK에서 전달

  @IsString()
  customerKey: string; // company id
}

export class CancelSubscriptionDto {
  @IsString()
  reason: string;

  @IsOptional()
  cancelAtPeriodEnd?: boolean; // true = 기간 만료 후 해지, false = 즉시
}
