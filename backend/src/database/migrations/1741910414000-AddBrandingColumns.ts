import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrandingColumns1741910414000 implements MigrationInterface {
  name = 'AddBrandingColumns1741910414000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // companies 테이블 — 커버 이미지 + 텍스트 색상
    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "cover_image_url"        TEXT,
        ADD COLUMN IF NOT EXISTS "cover_image_mobile_url" TEXT,
        ADD COLUMN IF NOT EXISTS "cover_mobile_crop"      JSONB,
        ADD COLUMN IF NOT EXISTS "branding_text_color"    VARCHAR(7) DEFAULT '#FFFFFF'
    `);

    // users 테이블 — 개인 커버 이미지
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "cover_image_url"        TEXT,
        ADD COLUMN IF NOT EXISTS "cover_image_mobile_url" TEXT,
        ADD COLUMN IF NOT EXISTS "cover_mobile_crop"      JSONB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "cover_mobile_crop",
        DROP COLUMN IF EXISTS "cover_image_mobile_url",
        DROP COLUMN IF EXISTS "cover_image_url"
    `);
    await queryRunner.query(`
      ALTER TABLE "companies"
        DROP COLUMN IF EXISTS "branding_text_color",
        DROP COLUMN IF EXISTS "cover_mobile_crop",
        DROP COLUMN IF EXISTS "cover_image_mobile_url",
        DROP COLUMN IF EXISTS "cover_image_url"
    `);
  }
}
