import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CompanyModule } from './entities/company-module.entity';
import {
  MODULE_CATALOG,
  MODULE_IDS,
  BASE_MODULE_IDS,
  ModuleId,
  ModuleDefinition,
} from './module-catalog.constants';
import {
  PLAN_MODULES,
  ADDON_MODULE_MAP,
  normalizePlanName,
  PlanName,
} from './plan-module-map.constants';
import {
  INDUSTRY_PRESETS,
  IndustryPresetId,
} from './industry-preset.constants';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';

export interface ModuleStatus extends ModuleDefinition {
  isActive: boolean;
  source: string | null;   // 'plan' | 'addon' | 'manual' | null(비활성)
}

@Injectable()
export class FeatureModulesService {
  constructor(
    @InjectRepository(CompanyModule)
    private moduleRepo: Repository<CompanyModule>,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // 조회
  // ─────────────────────────────────────────────────────────────

  /** 회사의 전체 모듈 상태 — 카탈로그 + 활성화 여부 병합 */
  async getModuleStatus(companyId: string): Promise<ModuleStatus[]> {
    const activeRows = await this.moduleRepo.find({
      where: { companyId, isActive: true },
    });
    const activeMap = new Map(activeRows.map((r) => [r.moduleId, r]));

    return MODULE_IDS.map((id) => {
      const row = activeMap.get(id);
      return {
        ...MODULE_CATALOG[id],
        isActive: !!row,
        source: row?.source ?? null,
      };
    });
  }

  /** 특정 모듈이 활성화되어 있는지 — Guard에서 호출 */
  async isModuleActive(companyId: string, moduleId: string): Promise<boolean> {
    // BASE 모듈은 항상 통과
    if ((BASE_MODULE_IDS as readonly string[]).includes(moduleId)) return true;

    const row = await this.moduleRepo.findOne({
      where: { companyId, moduleId, isActive: true },
    });
    return !!row;
  }

  /** 현재 활성 모듈 ID 목록만 반환 */
  async getActiveModuleIds(companyId: string): Promise<string[]> {
    const rows = await this.moduleRepo.find({
      where: { companyId, isActive: true },
      select: ['moduleId'],
    });
    return rows.map((r) => r.moduleId);
  }

  // ─────────────────────────────────────────────────────────────
  // 플랜 동기화
  // ─────────────────────────────────────────────────────────────

  /**
   * 플랜 변경 시 해당 플랜의 모듈을 전체 활성화.
   * 기존 plan 출처 모듈 중 새 플랜에 없는 것은 비활성화.
   * addon/manual 출처는 건드리지 않음.
   */
  async syncModulesForPlan(companyId: string, rawPlanName: string): Promise<void> {
    const planName = normalizePlanName(rawPlanName);
    const planModules = new Set<string>(PLAN_MODULES[planName]);

    // 현재 plan 출처 모듈 조회
    const existing = await this.moduleRepo.find({
      where: { companyId, source: 'plan' },
    });

    // 비활성화: plan 출처이지만 새 플랜에 없는 모듈
    const toDeactivate = existing.filter((r) => !planModules.has(r.moduleId));
    if (toDeactivate.length) {
      await this.moduleRepo.update(
        { companyId, moduleId: In(toDeactivate.map((r) => r.moduleId)), source: 'plan' },
        { isActive: false },
      );
    }

    // 활성화: 새 플랜 모듈 upsert
    const existingIds = new Set(existing.map((r) => r.moduleId));
    for (const moduleId of planModules) {
      if (existingIds.has(moduleId)) {
        await this.moduleRepo.update({ companyId, moduleId }, { isActive: true, source: 'plan' });
      } else {
        await this.moduleRepo.save(
          this.moduleRepo.create({ companyId, moduleId, isActive: true, source: 'plan' }),
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 애드온 활성화
  // ─────────────────────────────────────────────────────────────

  async activateFromAddon(
    companyId: string,
    addonCode: string,
    addonPurchaseId: string,
  ): Promise<void> {
    const moduleId = ADDON_MODULE_MAP[addonCode];
    if (!moduleId) return; // 모듈 연결 없는 애드온은 무시

    const existing = await this.moduleRepo.findOne({ where: { companyId, moduleId } });
    if (existing) {
      await this.moduleRepo.update(
        { companyId, moduleId },
        { isActive: true, source: 'addon', addonPurchaseId },
      );
    } else {
      await this.moduleRepo.save(
        this.moduleRepo.create({
          companyId,
          moduleId,
          isActive: true,
          source: 'addon',
          addonPurchaseId,
        }),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 수동 토글 (owner)
  // ─────────────────────────────────────────────────────────────

  async toggleModule(
    companyId: string,
    moduleId: string,
    isActive: boolean,
    actor: AuthenticatedUser,
  ): Promise<ModuleStatus> {
    if (actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('모듈 설정은 사업주만 변경할 수 있습니다.');
    }

    if (!(MODULE_IDS as readonly string[]).includes(moduleId)) {
      throw new BadRequestException(`알 수 없는 모듈 ID: ${moduleId}`);
    }

    const existing = await this.moduleRepo.findOne({ where: { companyId, moduleId } });
    if (existing) {
      await this.moduleRepo.update({ companyId, moduleId }, { isActive, source: 'manual' });
    } else {
      if (!isActive) {
        // 없는 모듈을 비활성화 요청 → 이미 비활성 상태이므로 무시
        return { ...MODULE_CATALOG[moduleId as ModuleId], isActive: false, source: null };
      }
      await this.moduleRepo.save(
        this.moduleRepo.create({ companyId, moduleId, isActive: true, source: 'manual' }),
      );
    }

    return { ...MODULE_CATALOG[moduleId as ModuleId], isActive, source: isActive ? 'manual' : null };
  }

  // ─────────────────────────────────────────────────────────────
  // 업종 프리셋 일괄 적용 (owner)
  // ─────────────────────────────────────────────────────────────

  /**
   * 프리셋의 추천 모듈 중 현재 플랜에서 사용 가능한 모듈만 활성화.
   * 현재 플랜 범위를 벗어난 모듈은 조용히 무시 (업그레이드 필요 목록 반환).
   */
  async applyIndustryPreset(
    companyId: string,
    presetId: IndustryPresetId,
    actor: AuthenticatedUser,
    currentPlanName: string,
  ): Promise<{ activated: string[]; skipped: string[] }> {
    if (actor.role !== UserRole.OWNER) {
      throw new ForbiddenException('프리셋 적용은 사업주만 할 수 있습니다.');
    }

    const preset = INDUSTRY_PRESETS[presetId];
    if (!preset) throw new BadRequestException(`알 수 없는 프리셋: ${presetId}`);

    const planModules = new Set<string>(PLAN_MODULES[normalizePlanName(currentPlanName)]);

    const activated: string[] = [];
    const skipped: string[] = [];

    for (const moduleId of preset.recommendedModules) {
      if (!planModules.has(moduleId)) {
        skipped.push(moduleId);
        continue;
      }
      const existing = await this.moduleRepo.findOne({ where: { companyId, moduleId } });
      if (existing) {
        await this.moduleRepo.update({ companyId, moduleId }, { isActive: true });
      } else {
        await this.moduleRepo.save(
          this.moduleRepo.create({ companyId, moduleId, isActive: true, source: 'manual' }),
        );
      }
      activated.push(moduleId);
    }

    return { activated, skipped };
  }
}
