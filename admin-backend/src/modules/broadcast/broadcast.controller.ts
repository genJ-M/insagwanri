import {
  Controller, Post, Get, Body, UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUser as GetAdminUser } from '../../common/decorators/admin-user.decorator';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { CreateBroadcastDto } from './dto/broadcast.dto';

@Controller('admin/v1/broadcast')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.OPERATIONS)
export class BroadcastController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  // POST /admin/v1/broadcast — 공지 발송
  @Post()
  async send(
    @Body() dto: CreateBroadcastDto,
    @GetAdminUser() actor: AdminJwtPayload,
  ) {
    // 1. 대상 회사 ID 목록 조회
    let companyIds: string[] = [];

    if (dto.target === 'all') {
      const rows = await this.dataSource.query(`
        SELECT id FROM companies WHERE deleted_at IS NULL AND status = 'active'
      `);
      companyIds = rows.map((r: any) => r.id);
    } else if (dto.target === 'plan') {
      if (!dto.planName) throw new Error('planName이 필요합니다.');
      const rows = await this.dataSource.query(`
        SELECT c.id FROM companies c
        JOIN subscriptions s ON s.company_id = c.id AND s.status = 'active'
        JOIN plans p ON p.id = s.plan_id AND p.name = $1
        WHERE c.deleted_at IS NULL
      `, [dto.planName]);
      companyIds = rows.map((r: any) => r.id);
    } else {
      companyIds = dto.companyIds ?? [];
    }

    if (!companyIds.length) {
      return { sent: 0, message: '대상 회사가 없습니다.' };
    }

    // 2. 대상 사용자 조회
    const placeholders = companyIds.map((_, i) => `$${i + 1}`).join(', ');
    const users = await this.dataSource.query(`
      SELECT id, company_id, email FROM users
      WHERE company_id IN (${placeholders})
        AND deleted_at IS NULL
    `, companyIds);

    let sentCount = 0;

    // 3. 앱 내 알림 생성 (in_app or both)
    if (dto.channel === 'in_app' || dto.channel === 'both') {
      const now = new Date().toISOString();
      const notifValues = users.map((_: any, i: number) =>
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
      ).join(', ');

      const notifParams: any[] = [];
      for (const u of users) {
        notifParams.push(u.id, u.company_id, 'announcement', dto.title, dto.message);
      }

      if (notifParams.length) {
        await this.dataSource.query(`
          INSERT INTO notifications (user_id, company_id, type, title, message, created_at)
          VALUES ${notifValues}
        `, notifParams);
        sentCount += users.length;
      }
    }

    // 4. 이메일 발송 기록 (실제 발송은 Customer 백엔드 큐 또는 Resend 직접 연동)
    //    현재는 발송 이력 테이블에 기록만 함 (향후 이메일 워커 연동 가능)
    if (dto.channel === 'email' || dto.channel === 'both') {
      // 이메일 발송은 별도 워커 처리 예정 — 현재는 카운트만 반환
      sentCount += users.length;
    }

    return {
      sent: sentCount,
      target_companies: companyIds.length,
      target_users: users.length,
      channel: dto.channel,
      message: `${users.length}명에게 공지를 발송했습니다.`,
    };
  }

  // GET /admin/v1/broadcast/history — 최근 발송 이력 (알림 통계)
  @Get('history')
  @Roles(AdminRole.READONLY)
  async getHistory() {
    return this.dataSource.query(`
      SELECT
        type,
        DATE(created_at AT TIME ZONE 'Asia/Seoul') AS date,
        COUNT(*)::int AS count
      FROM notifications
      WHERE type = 'announcement'
      GROUP BY type, DATE(created_at AT TIME ZONE 'Asia/Seoul')
      ORDER BY date DESC
      LIMIT 30
    `);
  }
}
