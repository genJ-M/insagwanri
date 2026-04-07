import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 개인 근무 스케줄 지원
 * - users.break_minutes                  : 개인 휴게시간(분) — null이면 법정 최소 자동 계산
 * - users.late_threshold_min_override    : 개인 지각 허용 시간(분) — null이면 회사 설정 사용
 * - users.schedule_note                  : 최근 스케줄 변경 사유
 * - attendance_records.break_minutes     : 퇴근 시 실제 적용된 휴게시간(분)
 *
 * 법정 근거: 근로기준법 제54조 (휴게시간)
 *   4시간 이상 근무 → 30분 이상
 *   8시간 이상 근무 → 60분 이상
 */
export class AddUserWorkSchedule1744001000000 implements MigrationInterface {
  name = 'AddUserWorkSchedule1744001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users 테이블 — 개인 스케줄 확장
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "break_minutes"                smallint NULL,
      ADD COLUMN IF NOT EXISTS "late_threshold_min_override"  smallint NULL,
      ADD COLUMN IF NOT EXISTS "schedule_note"                text NULL
    `);

    // attendance_records 테이블 — 퇴근 시 실제 적용된 휴게시간 기록
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "break_minutes" smallint NULL
    `);

    // approval_documents.type 은 varchar(20) 이므로 별도 ENUM 마이그레이션 불필요
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      DROP COLUMN IF EXISTS "break_minutes"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "break_minutes",
      DROP COLUMN IF EXISTS "late_threshold_min_override",
      DROP COLUMN IF EXISTS "schedule_note"
    `);
  }
}
