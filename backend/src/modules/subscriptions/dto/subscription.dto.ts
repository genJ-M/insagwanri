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

  /** 직원 수 (seat 기반 과금). 미지정 시 1명. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  seatCount?: number;

  /** 추가 지점 수. 미지정 시 0. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  extraLocations?: number;
}

export class PreviewSeatChangeDto {
  @IsInt()
  @Min(1)
  @Max(100)
  newSeatCount: number;
}

export class AddSeatsDto {
  @IsInt()
  @Min(1)
  @Max(100)
  newSeatCount: number;

  @IsUUID()
  paymentMethodId: string;
}

export class PreviewLocationChangeDto {
  @IsInt()
  @Min(0)
  @Max(50)
  newExtraLocations: number;
}

export class AddLocationsDto {
  @IsInt()
  @Min(0)
  @Max(50)
  newExtraLocations: number;

  @IsUUID()
  paymentMethodId: string;
}

/** 감소 예약 — 다음 청구주기부터 적용 */
export class ScheduleSeatDecreaseDto {
  @IsInt()
  @Min(1)
  @Max(100)
  newSeatCount: number;
}

export class ScheduleLocationDecreaseDto {
  @IsInt()
  @Min(0)
  @Max(50)
  newExtraLocations: number;
}

export class SetBillingDelegateDto {
  /** null = 위임 해제 */
  @IsOptional()
  @IsUUID()
  userId?: string | null;
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
