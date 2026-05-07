import { IsBoolean, IsString, IsIn } from 'class-validator';
import { INDUSTRY_PRESETS } from '../industry-preset.constants';

export class ToggleModuleDto {
  @IsBoolean()
  isActive: boolean;
}

export class ApplyPresetDto {
  @IsString()
  @IsIn(Object.keys(INDUSTRY_PRESETS))
  presetId: string;

  @IsString()
  currentPlanName: string;
}
