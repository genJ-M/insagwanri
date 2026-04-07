import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 출퇴근 연동 방식 지원
 * - companies.attendance_methods (JSONB): 활성 방식 목록 + WiFi SSID / QR 설정
 * - attendance_records.clock_in_method / clock_out_method (VARCHAR 20): 실제 사용 방식 기록
 */
export class AddAttendanceMethods1744000000000 implements MigrationInterface {
  name = 'AddAttendanceMethods1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // companies 테이블 — 출퇴근 방식 설정 컬럼
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "attendance_methods" jsonb NULL
    `);

    // attendance_records 테이블 — 실제 사용된 방식 기록
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "clock_in_method" varchar(20) NULL,
      ADD COLUMN IF NOT EXISTS "clock_out_method" varchar(20) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      DROP COLUMN IF EXISTS "clock_in_method",
      DROP COLUMN IF EXISTS "clock_out_method"
    `);

    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "attendance_methods"
    `);
  }
}
