import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

/**
 * 근로기준법 제42조 — 출퇴근 기록 3년 보관 의무
 *
 * 매일 새벽 2시에 실행:
 *   1. attendance_records 에서 work_date < 오늘 - 3년 인 행을 조회
 *   2. attendance_records_archive 에 INSERT (중복 시 무시)
 *   3. 원본 테이블에서 DELETE
 *
 * 단일 트랜잭션으로 처리하여 데이터 손실 방지.
 */
@Injectable()
export class AttendanceArchiveService {
  private readonly logger = new Logger(AttendanceArchiveService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async archiveOldRecords(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 3);
    const cutoff = cutoffDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    this.logger.log(`Attendance archive job started. cutoff=${cutoff}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 1 — 몇 건이 대상인지 먼저 조회
      const [{ count: targetCount }] = await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM attendance_records WHERE work_date < $1`,
        [cutoff],
      );

      // Step 2 — 아카이브 대상 행을 archive 테이블로 복사 (중복 무시)
      await queryRunner.query(
        `INSERT INTO attendance_records_archive (
           id, company_id, user_id, work_date,
           clock_in_at, clock_out_at,
           clock_in_lat, clock_in_lng,
           clock_out_lat, clock_out_lng,
           clock_in_distance_m, clock_in_out_of_range,
           gps_bypassed, status, is_late, late_minutes,
           total_work_minutes, note,
           approved_by, approved_at,
           created_at, updated_at, archived_at
         )
         SELECT
           id, company_id, user_id, work_date,
           clock_in_at, clock_out_at,
           clock_in_lat, clock_in_lng,
           clock_out_lat, clock_out_lng,
           clock_in_distance_m, clock_in_out_of_range,
           gps_bypassed, status, is_late, late_minutes,
           total_work_minutes, note,
           approved_by, approved_at,
           created_at, updated_at, NOW()
         FROM attendance_records
         WHERE work_date < $1
         ON CONFLICT (id) DO NOTHING`,
        [cutoff],
      );

      // Step 3 — 원본 삭제
      await queryRunner.query(
        `DELETE FROM attendance_records WHERE work_date < $1`,
        [cutoff],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Attendance archive complete. archived=${targetCount} records (cutoff: ${cutoff})`,
      );
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Attendance archive job failed, rolled back', err);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 아카이브된 기록 조회 (관리자 또는 법적 요청 대응용)
   */
  async findArchivedByCompany(
    companyId: string,
    from: string,
    to: string,
  ): Promise<any[]> {
    return this.dataSource.query(
      `SELECT * FROM attendance_records_archive
       WHERE company_id = $1
         AND work_date BETWEEN $2 AND $3
       ORDER BY work_date DESC`,
      [companyId, from, to],
    );
  }
}
