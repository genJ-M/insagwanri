import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMarketingTables1746500000000 implements MigrationInterface {
  name = 'CreateMarketingTables1746500000000';

  public async up(qr: QueryRunner): Promise<void> {
    // ── marketing_blocks ──────────────────────────────────────────
    await qr.query(`
      CREATE TABLE marketing_blocks (
        section   VARCHAR(80)  NOT NULL,
        key       VARCHAR(80)  NOT NULL,
        label     VARCHAR(200) NOT NULL DEFAULT '',
        value     TEXT         NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (section, key)
      )
    `);

    // ── marketing_banners ─────────────────────────────────────────
    await qr.query(`
      CREATE TABLE marketing_banners (
        id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        text       TEXT         NOT NULL,
        link_url   VARCHAR(500),
        link_text  VARCHAR(100),
        bg_color   VARCHAR(30)  NOT NULL DEFAULT '#1d4ed8',
        text_color VARCHAR(30)  NOT NULL DEFAULT '#ffffff',
        is_active  BOOLEAN      NOT NULL DEFAULT FALSE,
        starts_at  TIMESTAMPTZ,
        ends_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // ── marketing_popups ──────────────────────────────────────────
    await qr.query(`
      CREATE TABLE marketing_popups (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(100) NOT NULL,
        title         VARCHAR(200) NOT NULL,
        body          TEXT         NOT NULL,
        cta_text      VARCHAR(80),
        cta_url       VARCHAR(500),
        trigger_type  VARCHAR(30)  NOT NULL DEFAULT 'immediate',
        trigger_value INTEGER      NOT NULL DEFAULT 0,
        target        VARCHAR(30)  NOT NULL DEFAULT 'all',
        dismiss_days  INTEGER      NOT NULL DEFAULT 7,
        is_active     BOOLEAN      NOT NULL DEFAULT FALSE,
        starts_at     TIMESTAMPTZ,
        ends_at       TIMESTAMPTZ,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // ── seed: 초기 텍스트 블록 ────────────────────────────────────
    await qr.query(`
      INSERT INTO marketing_blocks (section, key, label, value) VALUES
        ('hero', 'badge',         '배지 문구',        '🚀 중소사업장을 위한 스마트 인사 관리'),
        ('hero', 'title_line1',   '제목 1줄',         '복잡한 인사 관리,'),
        ('hero', 'title_line2',   '제목 2줄',         '이제 쉽게 해결하세요'),
        ('hero', 'subtitle',      '부제목',           '출근 기록부터 급여 계산, 연차 관리까지 — 중소사업장에 꼭 맞는 올인원 솔루션'),
        ('hero', 'cta_primary',   '주 버튼 텍스트',   '무료로 시작하기'),
        ('hero', 'cta_secondary', '보조 버튼 텍스트', '데모 보기'),
        ('hero', 'trust_1',       '신뢰 지표 1',      '⚡ 5분 만에 시작'),
        ('hero', 'trust_2',       '신뢰 지표 2',      '🔒 데이터 암호화'),
        ('hero', 'trust_3',       '신뢰 지표 3',      '📱 모바일 앱 제공'),
        ('hero', 'trust_4',       '신뢰 지표 4',      '🆓 무료 플랜 운영'),
        ('pricing', 'badge',      '요금제 배지',       '💰 합리적인 요금제'),
        ('pricing', 'title',      '요금제 제목',       '우리 팀에 딱 맞는 플랜 선택'),
        ('pricing', 'subtitle',   '요금제 부제목',     '소규모 팀부터 중견 기업까지, 유연하게 확장 가능한 플랜을 제공합니다'),
        ('features', 'badge',     '기능 배지',        '✨ 핵심 기능'),
        ('features', 'title',     '기능 제목',        '업무에 필요한 모든 것'),
        ('features', 'subtitle',  '기능 부제목',      '관리왕 하나로 인사·근태·급여를 통합 관리하세요'),
        ('cta', 'title',          'CTA 제목',         '지금 바로 시작해보세요'),
        ('cta', 'subtitle',       'CTA 부제목',       '신용카드 없이 무료로 시작. 언제든지 업그레이드 가능.'),
        ('cta', 'button',         'CTA 버튼',         '무료 계정 만들기')
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS marketing_popups`);
    await qr.query(`DROP TABLE IF EXISTS marketing_banners`);
    await qr.query(`DROP TABLE IF EXISTS marketing_blocks`);
  }
}
