import { IsString, IsEnum, IsOptional, IsUUID, IsBoolean, IsIn, IsInt, Min, Max } from 'class-validator';
import { ADDON_CATALOG } from '../addon-catalog.constant';

const ADDON_CODES = ADDON_CATALOG.map((a) => a.code);

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

export class ToggleAutoRenewDto {
  @IsBoolean()
  autoRenew: boolean;
}

export class PurchaseAddonDto {
  @IsIn(ADDON_CODES)
  addonCode: string;

  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;

  @IsEnum(BillingCycleDto)
  billingCycle: BillingCycleDto;

  @IsUUID()
  paymentMethodId: string;
}
