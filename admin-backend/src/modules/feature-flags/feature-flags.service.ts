import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createClient, RedisClientType } from 'redis';
import { Feature } from '../../database/entities/feature.entity';
import { CompanyFeature, OverrideType } from '../../database/entities/company-feature.entity';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';

const CACHE_TTL_SEC = 300; // 5분

export interface FeatureResult {
  key: string;
  enabled: boolean;
  limitValue?: number | null;
  configValue?: Record<string, any> | null;
  source: 'company_override' | 'plan_setting' | 'global_default';
}

@Injectable()
export class FeatureFlagsService {
  private redis: RedisClientType | null = null;

  constructor(
    @InjectRepository(Feature)
    private featureRepository: Repository<Feature>,

    @InjectRepository(CompanyFeature)
    private companyFeatureRepository: Repository<CompanyFeature>,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      this.redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
      this.redis.on('error', () => { this.redis = null; });
      await this.redis.connect();
    } catch {
      this.redis = null;
    }
  }

  // ──────────────────────────────────────────────
  // 회사별 모든 feature 해석 (우선순위 적용)
  // ──────────────────────────────────────────────
  async getCompanyFeatures(companyId: string): Promise<FeatureResult[]> {
    const cacheKey = `features:${companyId}`;

    // Redis 캐시 확인
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* Redis 실패 시 DB로 폴백 */ }
    }

    // DB에서 조회 (plan_features JOIN)
    const results = await this.featureRepository.query(`
      SELECT
        f.key, f.feature_type, f.default_enabled, f.default_config,
        pf.is_enabled AS plan_enabled, pf.limit_value AS plan_limit, pf.config_value AS plan_config,
        cf.override_type, cf.is_enabled AS co_enabled,
        cf.limit_value AS co_limit, cf.config_value AS co_config,
        cf.expires_at
      FROM features f
      LEFT JOIN subscriptions s ON s.company_id = $1
      LEFT JOIN plan_features pf ON pf.plan_id = s.plan_id AND pf.feature_id = f.id
      LEFT JOIN company_features cf ON cf.company_id = $1 AND cf.feature_id = f.id
        AND (cf.expires_at IS NULL OR cf.expires_at > NOW())
      WHERE f.is_active = true
      ORDER BY f.sort_order ASC
    `, [companyId]);

    const resolved: FeatureResult[] = results.map((row: any) => {
      // Priority 1: company override
      if (row.override_type) {
        return {
          key: row.key,
          enabled: row.co_enabled ?? false,
          limitValue: row.co_limit,
          configValue: row.co_config,
          source: 'company_override',
        } as FeatureResult;
      }
      // Priority 2: plan setting
      if (row.plan_enabled !== null) {
        return {
          key: row.key,
          enabled: row.plan_enabled ?? false,
          limitValue: row.plan_limit,
          configValue: row.plan_config,
          source: 'plan_setting',
        } as FeatureResult;
      }
      // Priority 3: global default
      return {
        key: row.key,
        enabled: row.default_enabled ?? false,
        configValue: row.default_config,
        source: 'global_default',
      } as FeatureResult;
    });

    // Redis 캐시 저장
    if (this.redis) {
      try {
        await this.redis.setEx(cacheKey, CACHE_TTL_SEC, JSON.stringify(resolved));
      } catch { /* 캐시 실패는 무시 */ }
    }

    return resolved;
  }

  // ──────────────────────────────────────────────
  // 회사 feature override 설정
  // ──────────────────────────────────────────────
  async setCompanyOverride(
    companyId: string,
    featureKey: string,
    params: {
      overrideType: OverrideType;
      isEnabled?: boolean;
      limitValue?: number;
      configValue?: Record<string, any>;
      reason: string;
      expiresAt?: Date;
    },
    actor: AdminJwtPayload,
  ): Promise<CompanyFeature> {
    const feature = await this.featureRepository.findOne({ where: { key: featureKey } });
    if (!feature) throw new NotFoundException(`기능 '${featureKey}'을 찾을 수 없습니다.`);

    // upsert
    const existing = await this.companyFeatureRepository.findOne({
      where: { companyId, featureId: feature.id },
    });

    const data = {
      companyId,
      featureId: feature.id,
      overrideType: params.overrideType,
      isEnabled: params.isEnabled ?? null,
      limitValue: params.limitValue ?? null,
      configValue: params.configValue ?? null,
      reason: params.reason,
      appliedBy: actor.sub,
      expiresAt: params.expiresAt ?? null,
    };

    let saved: CompanyFeature;
    if (existing) {
      await this.companyFeatureRepository.update(existing.id, data);
      saved = { ...existing, ...data } as CompanyFeature;
    } else {
      saved = await this.companyFeatureRepository.save(
        this.companyFeatureRepository.create(data),
      );
    }

    // 캐시 무효화
    await this.invalidateCache(companyId);

    return saved;
  }

  // ──────────────────────────────────────────────
  // 회사 feature override 삭제 (플랜 기본값으로 복구)
  // ──────────────────────────────────────────────
  async removeCompanyOverride(companyId: string, featureKey: string): Promise<void> {
    const feature = await this.featureRepository.findOne({ where: { key: featureKey } });
    if (!feature) throw new NotFoundException(`기능 '${featureKey}'을 찾을 수 없습니다.`);

    await this.companyFeatureRepository.delete({ companyId, featureId: feature.id });
    await this.invalidateCache(companyId);
  }

  // ──────────────────────────────────────────────
  // 모든 features 목록 (관리용)
  // ──────────────────────────────────────────────
  async getAllFeatures(): Promise<Feature[]> {
    return this.featureRepository.find({ order: { sortOrder: 'ASC' } });
  }

  private async invalidateCache(companyId: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(`features:${companyId}`);
      } catch { /* 무시 */ }
    }
  }
}
