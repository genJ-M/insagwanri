/**
 * 마스터 데이터 시드 스크립트
 * 실행: npm run seed
 *
 * 삽입 데이터:
 *   - plans        (free / basic / pro / enterprise)
 *   - features     (기능 키 마스터)
 *   - plan_features (플랜별 기능 설정)
 *   - admin_users  (SUPER_ADMIN 계정 1개)
 *
 * 주의: migration:run 이후 실행할 것 (테이블 선행 생성 필요)
 */

import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

config();

// ── DataSource (seed 전용) ────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  entities: [],
});

// ── 데이터 정의 ───────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'free',
    display_name: '무료',
    price_monthly_krw: 0,
    price_yearly_krw: 0,
    yearly_discount_rate: 0,
    max_employees: 5,
    ai_requests_per_day: 10,
    storage_limit_gb: 1,
    trial_days: 0,
    is_public: true,
    sort_order: 1,
  },
  {
    name: 'basic',
    display_name: '베이직',
    price_monthly_krw: 49000,
    price_yearly_krw: 470400,   // 49,000 × 12 × 0.8
    yearly_discount_rate: 20,
    max_employees: 30,
    ai_requests_per_day: 50,
    storage_limit_gb: 10,
    trial_days: 14,
    is_public: true,
    sort_order: 2,
  },
  {
    name: 'pro',
    display_name: '프로',
    price_monthly_krw: 99000,
    price_yearly_krw: 950400,   // 99,000 × 12 × 0.8
    yearly_discount_rate: 20,
    max_employees: 100,
    ai_requests_per_day: 200,
    storage_limit_gb: 50,
    trial_days: 14,
    is_public: true,
    sort_order: 3,
  },
  {
    name: 'enterprise',
    display_name: '엔터프라이즈',
    price_monthly_krw: 0,       // 영업 협의
    price_yearly_krw: 0,
    yearly_discount_rate: 0,
    max_employees: 9999,
    ai_requests_per_day: 500,
    storage_limit_gb: 500,
    trial_days: 30,
    is_public: false,           // 영업 전용 (플랜 선택 UI 미노출)
    sort_order: 4,
  },
];

const FEATURES = [
  // [core] 근태
  { key: 'attendance_basic',       category: 'core',          feature_type: 'boolean', name: '기본 출퇴근 관리',   default_enabled: true,  sort_order: 10 },
  { key: 'attendance_gps',         category: 'core',          feature_type: 'boolean', name: 'GPS 출퇴근 검증',    default_enabled: false, sort_order: 11 },
  { key: 'attendance_report',      category: 'core',          feature_type: 'boolean', name: '근태 리포트',        default_enabled: false, sort_order: 12 },
  // [core] 업무
  { key: 'tasks_basic',            category: 'core',          feature_type: 'boolean', name: '기본 업무 관리',     default_enabled: true,  sort_order: 20 },
  { key: 'tasks_subtasks',         category: 'core',          feature_type: 'boolean', name: '하위 업무',          default_enabled: false, sort_order: 21 },
  { key: 'tasks_report',           category: 'core',          feature_type: 'boolean', name: '업무 보고서',        default_enabled: false, sort_order: 22 },
  // [core] 일정
  { key: 'schedule_basic',         category: 'core',          feature_type: 'boolean', name: '개인 일정 관리',     default_enabled: true,  sort_order: 30 },
  { key: 'schedule_company_wide',  category: 'core',          feature_type: 'boolean', name: '전사 일정 공유',     default_enabled: false, sort_order: 31 },
  // [collaboration]
  { key: 'messages_basic',         category: 'collaboration', feature_type: 'boolean', name: '기본 메시지',        default_enabled: true,  sort_order: 40 },
  { key: 'messages_channels',      category: 'collaboration', feature_type: 'boolean', name: '채널 메시지',        default_enabled: false, sort_order: 41 },
  { key: 'messages_announcements', category: 'collaboration', feature_type: 'boolean', name: '공지 채널',          default_enabled: false, sort_order: 42 },
  // [ai]
  { key: 'ai_draft',               category: 'ai',            feature_type: 'boolean', name: 'AI 문장 작성',       default_enabled: false, sort_order: 50 },
  { key: 'ai_summarize',           category: 'ai',            feature_type: 'boolean', name: 'AI 보고서 요약',     default_enabled: false, sort_order: 51 },
  { key: 'ai_announcement',        category: 'ai',            feature_type: 'boolean', name: 'AI 공지 생성',       default_enabled: false, sort_order: 52 },
  { key: 'ai_schedule_summary',    category: 'ai',            feature_type: 'boolean', name: 'AI 일정 정리',       default_enabled: false, sort_order: 53 },
  { key: 'ai_refine',              category: 'ai',            feature_type: 'boolean', name: 'AI 문장 다듬기',     default_enabled: false, sort_order: 54 },
  { key: 'ai_requests_per_day',    category: 'ai',            feature_type: 'limit',   name: 'AI 일일 요청 한도',  default_enabled: true,  sort_order: 55, default_config: { limit: 10 } },
  // [analytics]
  { key: 'reports_basic',          category: 'analytics',     feature_type: 'boolean', name: '기본 리포트',        default_enabled: false, sort_order: 60 },
  { key: 'reports_advanced',       category: 'analytics',     feature_type: 'boolean', name: '심화 분석 리포트',   default_enabled: false, sort_order: 61 },
  { key: 'data_export_csv',        category: 'analytics',     feature_type: 'boolean', name: 'CSV 내보내기',       default_enabled: false, sort_order: 62 },
  { key: 'data_export_excel',      category: 'analytics',     feature_type: 'boolean', name: 'Excel 내보내기',     default_enabled: false, sort_order: 63 },
  // [admin]
  { key: 'custom_roles',           category: 'admin',         feature_type: 'boolean', name: '커스텀 역할',        default_enabled: false, sort_order: 70 },
  { key: 'audit_logs',             category: 'admin',         feature_type: 'boolean', name: '감사 로그',          default_enabled: false, sort_order: 71 },
  { key: 'api_access',             category: 'admin',         feature_type: 'boolean', name: 'API 접근',           default_enabled: false, sort_order: 72 },
  { key: 'max_employees',          category: 'admin',         feature_type: 'limit',   name: '최대 직원 수',       default_enabled: true,  sort_order: 73, default_config: { limit: 5 } },
  { key: 'storage_gb',             category: 'admin',         feature_type: 'limit',   name: '스토리지 (GB)',      default_enabled: true,  sort_order: 74, default_config: { limit: 1 } },
  // [integration]
  { key: 'sso',                    category: 'integration',   feature_type: 'boolean', name: 'SSO 연동',           default_enabled: false, sort_order: 80 },
  { key: 'webhooks',               category: 'integration',   feature_type: 'boolean', name: '웹훅',              default_enabled: false, sort_order: 81 },
];

// plan_features 설정: { planName → { featureKey → { is_enabled, limit_value? } } }
const PLAN_FEATURES: Record<string, Record<string, { is_enabled: boolean; limit_value?: number }>> = {
  free: {
    attendance_basic:       { is_enabled: true },
    attendance_gps:         { is_enabled: false },
    attendance_report:      { is_enabled: false },
    tasks_basic:            { is_enabled: true },
    tasks_subtasks:         { is_enabled: false },
    tasks_report:           { is_enabled: false },
    schedule_basic:         { is_enabled: true },
    schedule_company_wide:  { is_enabled: false },
    messages_basic:         { is_enabled: true },
    messages_channels:      { is_enabled: false },
    messages_announcements: { is_enabled: false },
    ai_draft:               { is_enabled: true },
    ai_summarize:           { is_enabled: false },
    ai_announcement:        { is_enabled: false },
    ai_schedule_summary:    { is_enabled: false },
    ai_refine:              { is_enabled: false },
    ai_requests_per_day:    { is_enabled: true, limit_value: 10 },
    reports_basic:          { is_enabled: false },
    reports_advanced:       { is_enabled: false },
    data_export_csv:        { is_enabled: false },
    data_export_excel:      { is_enabled: false },
    custom_roles:           { is_enabled: false },
    audit_logs:             { is_enabled: false },
    api_access:             { is_enabled: false },
    max_employees:          { is_enabled: true, limit_value: 5 },
    storage_gb:             { is_enabled: true, limit_value: 1 },
    sso:                    { is_enabled: false },
    webhooks:               { is_enabled: false },
  },
  basic: {
    attendance_basic:       { is_enabled: true },
    attendance_gps:         { is_enabled: true },
    attendance_report:      { is_enabled: true },
    tasks_basic:            { is_enabled: true },
    tasks_subtasks:         { is_enabled: true },
    tasks_report:           { is_enabled: true },
    schedule_basic:         { is_enabled: true },
    schedule_company_wide:  { is_enabled: true },
    messages_basic:         { is_enabled: true },
    messages_channels:      { is_enabled: true },
    messages_announcements: { is_enabled: true },
    ai_draft:               { is_enabled: true },
    ai_summarize:           { is_enabled: true },
    ai_announcement:        { is_enabled: true },
    ai_schedule_summary:    { is_enabled: false },
    ai_refine:              { is_enabled: true },
    ai_requests_per_day:    { is_enabled: true, limit_value: 50 },
    reports_basic:          { is_enabled: true },
    reports_advanced:       { is_enabled: false },
    data_export_csv:        { is_enabled: true },
    data_export_excel:      { is_enabled: false },
    custom_roles:           { is_enabled: false },
    audit_logs:             { is_enabled: false },
    api_access:             { is_enabled: false },
    max_employees:          { is_enabled: true, limit_value: 30 },
    storage_gb:             { is_enabled: true, limit_value: 10 },
    sso:                    { is_enabled: false },
    webhooks:               { is_enabled: false },
  },
  pro: {
    attendance_basic:       { is_enabled: true },
    attendance_gps:         { is_enabled: true },
    attendance_report:      { is_enabled: true },
    tasks_basic:            { is_enabled: true },
    tasks_subtasks:         { is_enabled: true },
    tasks_report:           { is_enabled: true },
    schedule_basic:         { is_enabled: true },
    schedule_company_wide:  { is_enabled: true },
    messages_basic:         { is_enabled: true },
    messages_channels:      { is_enabled: true },
    messages_announcements: { is_enabled: true },
    ai_draft:               { is_enabled: true },
    ai_summarize:           { is_enabled: true },
    ai_announcement:        { is_enabled: true },
    ai_schedule_summary:    { is_enabled: true },
    ai_refine:              { is_enabled: true },
    ai_requests_per_day:    { is_enabled: true, limit_value: 200 },
    reports_basic:          { is_enabled: true },
    reports_advanced:       { is_enabled: true },
    data_export_csv:        { is_enabled: true },
    data_export_excel:      { is_enabled: true },
    custom_roles:           { is_enabled: true },
    audit_logs:             { is_enabled: true },
    api_access:             { is_enabled: false },
    max_employees:          { is_enabled: true, limit_value: 100 },
    storage_gb:             { is_enabled: true, limit_value: 50 },
    sso:                    { is_enabled: false },
    webhooks:               { is_enabled: false },
  },
  enterprise: {
    attendance_basic:       { is_enabled: true },
    attendance_gps:         { is_enabled: true },
    attendance_report:      { is_enabled: true },
    tasks_basic:            { is_enabled: true },
    tasks_subtasks:         { is_enabled: true },
    tasks_report:           { is_enabled: true },
    schedule_basic:         { is_enabled: true },
    schedule_company_wide:  { is_enabled: true },
    messages_basic:         { is_enabled: true },
    messages_channels:      { is_enabled: true },
    messages_announcements: { is_enabled: true },
    ai_draft:               { is_enabled: true },
    ai_summarize:           { is_enabled: true },
    ai_announcement:        { is_enabled: true },
    ai_schedule_summary:    { is_enabled: true },
    ai_refine:              { is_enabled: true },
    ai_requests_per_day:    { is_enabled: true, limit_value: 500 },
    reports_basic:          { is_enabled: true },
    reports_advanced:       { is_enabled: true },
    data_export_csv:        { is_enabled: true },
    data_export_excel:      { is_enabled: true },
    custom_roles:           { is_enabled: true },
    audit_logs:             { is_enabled: true },
    api_access:             { is_enabled: true },
    max_employees:          { is_enabled: true, limit_value: 9999 },
    storage_gb:             { is_enabled: true, limit_value: 500 },
    sso:                    { is_enabled: true },
    webhooks:               { is_enabled: true },
  },
};

// ── 유틸 ─────────────────────────────────────────────────────────────────────

async function upsertRow(
  qr: ReturnType<DataSource['createQueryRunner']>,
  table: string,
  uniqueCol: string,
  row: Record<string, unknown>,
): Promise<string> {
  const existing = await qr.query(
    `SELECT id FROM "${table}" WHERE "${uniqueCol}" = $1`,
    [row[uniqueCol]],
  );
  if (existing.length > 0) {
    console.log(`  [SKIP] ${table}.${uniqueCol}=${row[uniqueCol]} already exists`);
    return existing[0].id as string;
  }
  const keys = Object.keys(row);
  const values = Object.values(row);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const cols = keys.map(k => `"${k}"`).join(', ');
  const result = await qr.query(
    `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING id`,
    values,
  );
  console.log(`  [INSERT] ${table}.${uniqueCol}=${row[uniqueCol]}`);
  return result[0].id as string;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    console.log('\n=== 1. plans 시드 ===');
    const planIds: Record<string, string> = {};
    for (const plan of PLANS) {
      planIds[plan.name] = await upsertRow(qr, 'plans', 'name', plan);
    }

    console.log('\n=== 2. features 시드 ===');
    const featureIds: Record<string, string> = {};
    for (const feat of FEATURES) {
      const row: Record<string, unknown> = {
        key: feat.key,
        category: feat.category,
        feature_type: feat.feature_type,
        name: feat.name,
        default_enabled: feat.default_enabled,
        default_config: JSON.stringify(feat.default_config ?? {}),
        is_active: true,
        sort_order: feat.sort_order,
      };
      featureIds[feat.key] = await upsertRow(qr, 'features', 'key', row);
    }

    console.log('\n=== 3. plan_features 시드 ===');
    for (const [planName, featureMap] of Object.entries(PLAN_FEATURES)) {
      const planId = planIds[planName];
      for (const [featureKey, cfg] of Object.entries(featureMap)) {
        const featureId = featureIds[featureKey];
        const existing = await qr.query(
          `SELECT 1 FROM "plan_features" WHERE "plan_id" = $1 AND "feature_id" = $2`,
          [planId, featureId],
        );
        if (existing.length > 0) {
          console.log(`  [SKIP] plan_features ${planName}.${featureKey}`);
          continue;
        }
        await qr.query(
          `INSERT INTO "plan_features" ("plan_id", "feature_id", "is_enabled", "limit_value")
           VALUES ($1, $2, $3, $4)`,
          [planId, featureId, cfg.is_enabled, cfg.limit_value ?? null],
        );
        console.log(`  [INSERT] plan_features ${planName}.${featureKey}`);
      }
    }

    console.log('\n=== 4. SUPER_ADMIN 계정 시드 ===');
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@gwanri-wang.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe!1234';
    const passwordHash = await bcrypt.hash(superAdminPassword, 12);

    const existingAdmin = await qr.query(
      `SELECT id FROM "admin_users" WHERE "email" = $1`,
      [superAdminEmail],
    );
    if (existingAdmin.length > 0) {
      console.log(`  [SKIP] admin_users.email=${superAdminEmail} already exists`);
    } else {
      await qr.query(
        `INSERT INTO "admin_users" ("email", "password_hash", "name", "role")
         VALUES ($1, $2, $3, $4)`,
        [superAdminEmail, passwordHash, '최고 관리자', 'super_admin'],
      );
      console.log(`  [INSERT] SUPER_ADMIN: ${superAdminEmail}`);
      console.log(`  ⚠️  초기 비밀번호: ${superAdminPassword} — 배포 전 반드시 변경하세요!`);
    }

    await qr.commitTransaction();
    console.log('\n✅ 시드 완료\n');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('\n❌ 시드 실패, 롤백 완료:', err);
    process.exit(1);
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seed();
