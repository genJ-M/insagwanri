import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceArchive1741910403000 implements MigrationInterface {
  name = 'AttendanceArchive1741910403000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 아카이브 테이블: 원본과 동일한 컬럼 구조, FK 없음 (이미 탈퇴한 사용자 데이터도 보존)
    await queryRunner.query(`
      CREATE TABLE "attendance_records_archive" (
        "id"                      uuid        NOT NULL,
        "company_id"              uuid        NOT NULL,
        "user_id"                 uuid        NOT NULL,
        "work_date"               date        NOT NULL,
        "clock_in_at"             timestamptz,
        "clock_out_at"            timestamptz,
        "clock_in_lat"            decimal(10,7),
        "clock_in_lng"            decimal(10,7),
        "clock_out_lat"           decimal(10,7),
        "clock_out_lng"           decimal(10,7),
        "clock_in_distance_m"     integer,
        "clock_in_out_of_range"   boolean     NOT NULL DEFAULT false,
        "gps_bypassed"            boolean     NOT NULL DEFAULT false,
        "status"                  varchar(20) NOT NULL DEFAULT 'pending',
        "is_late"                 boolean     NOT NULL DEFAULT false,
        "late_minutes"            smallint,
        "total_work_minutes"      smallint,
        "note"                    text,
        "approved_by"             uuid,
        "approved_at"             timestamptz,
        "created_at"              timestamptz NOT NULL,
        "updated_at"              timestamptz NOT NULL,
        "archived_at"             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_attendance_archive" PRIMARY KEY ("id")
      )
    `);

    // 조회용 인덱스
    await queryRunner.query(`
      CREATE INDEX "idx_att_archive_company_date"
        ON "attendance_records_archive" ("company_id", "work_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_att_archive_user_date"
        ON "attendance_records_archive" ("user_id", "work_date")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_att_archive_archived_at"
        ON "attendance_records_archive" ("archived_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_records_archive"`);
  }
}
