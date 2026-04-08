import {
  Injectable, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addDays, format, getDate, getDay, getMonth, getDaysInMonth } from 'date-fns';
import { RecurringCalendarEvent } from '../../database/entities/recurring-calendar-event.entity';
import { DepartmentPageVisibility } from '../../database/entities/department-page-visibility.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateRecurringEventDto, UpdateRecurringEventDto,
  SetDepartmentVisibilityDto, ApplyTemplateDto,
} from './dto/calendar-settings.dto';
import { NotificationsService } from '../notifications/notifications.service';

// ─── 팀별 페이지 템플릿 ────────────────────────────────────────────────────────
const DEPT_TEMPLATES: Record<string, {
  name: string;
  emoji: string;
  visible: string[] | 'all';
  recurringEvents?: Array<{
    title: string; category: string; recurrenceType: string;
    dayOfMonth?: number; monthOfYear?: number[]; color: string;
    notifyBeforeDays: number[];
  }>;
}> = {
  finance: {
    name: '재무/회계팀', emoji: '💰',
    visible: ['/', '/calendar', '/salary', '/tax-documents', '/approvals', '/tasks', '/tasks/reports', '/attendance', '/vacations', '/ai', '/calendar-settings'],
    recurringEvents: [
      { title: '급여 지급일', category: 'payroll', recurrenceType: 'monthly', dayOfMonth: 25, color: '#10B981', notifyBeforeDays: [3, 1] },
      { title: '원천세 신고', category: 'tax', recurrenceType: 'monthly', dayOfMonth: 10, color: '#F59E0B', notifyBeforeDays: [5, 2] },
      { title: '부가세 신고 (분기)', category: 'tax', recurrenceType: 'quarterly', monthOfYear: [1, 4, 7, 10], dayOfMonth: 25, color: '#EF4444', notifyBeforeDays: [14, 7, 3] },
      { title: '4대보험 납부', category: 'deadline', recurrenceType: 'monthly', dayOfMonth: 10, color: '#6366F1', notifyBeforeDays: [3, 1] },
    ],
  },
  hr: {
    name: 'HR/인사팀', emoji: '👥',
    visible: ['/', '/team', '/team/notes', '/team/stats', '/attendance', '/vacations', '/calendar', '/contracts', '/approvals', '/salary', '/evaluations', '/training', '/tasks', '/messages', '/ai', '/calendar-settings'],
    recurringEvents: [
      { title: '월간 인사 보고', category: 'report', recurrenceType: 'monthly', dayOfMonth: 28, color: '#8B5CF6', notifyBeforeDays: [3] },
    ],
  },
  operations: {
    name: '운영/현장팀', emoji: '⚙️',
    visible: ['/', '/tasks', '/schedule', '/shift-schedule', '/calendar', '/attendance', '/vacations', '/messages', '/approvals'],
    recurringEvents: [
      { title: '주간 운영 보고', category: 'report', recurrenceType: 'weekly', dayOfMonth: 5, color: '#0EA5E9', notifyBeforeDays: [1] },
    ],
  },
  sales: {
    name: '영업팀', emoji: '📈',
    visible: ['/', '/tasks', '/tasks/reports', '/calendar', '/approvals', '/attendance', '/vacations', '/messages', '/ai'],
    recurringEvents: [
      { title: '월간 영업 실적 보고', category: 'report', recurrenceType: 'monthly', dayOfMonth: 28, color: '#F97316', notifyBeforeDays: [3, 1] },
    ],
  },
  it: {
    name: 'IT/개발팀', emoji: '💻',
    visible: ['/', '/tasks', '/tasks/reports', '/schedule', '/calendar', '/approvals', '/attendance', '/vacations', '/messages', '/ai'],
  },
  management: {
    name: '경영/임원', emoji: '🏢',
    visible: 'all',
  },
  general: {
    name: '기본 (기타)', emoji: '📋',
    visible: ['/', '/attendance', '/vacations', '/calendar', '/tasks', '/approvals', '/messages', '/ai'],
  },
};

export const ALL_PAGE_KEYS = [
  '/', '/attendance', '/vacations', '/calendar', '/tasks', '/tasks/reports',
  '/schedule', '/shift-schedule', '/messages',
  '/team', '/team/notes', '/team/stats', '/salary', '/contracts',
  '/approvals', '/certificates', '/evaluations', '/training',
  '/tax-documents', '/ai', '/settings', '/calendar-settings',
];

@Injectable()
export class CalendarSettingsService {
  private readonly logger = new Logger(CalendarSettingsService.name);

  constructor(
    @InjectRepository(RecurringCalendarEvent)
    private recurringRepo: Repository<RecurringCalendarEvent>,

    @InjectRepository(DepartmentPageVisibility)
    private visibilityRepo: Repository<DepartmentPageVisibility>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    private notificationsService: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // 반복 일정 CRUD
  // ═══════════════════════════════════════════════════════════

  async getRecurringEvents(user: AuthenticatedUser) {
    const events = await this.recurringRepo.find({
      where: { companyId: user.companyId, deletedAt: IsNull() },
      order: { category: 'ASC', title: 'ASC' },
    });
    return { success: true, data: events };
  }

  async createRecurringEvent(user: AuthenticatedUser, dto: CreateRecurringEventDto) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const ev = this.recurringRepo.create({
      companyId:        user.companyId,
      createdById:      user.id,
      title:            dto.title,
      description:      dto.description ?? null,
      category:         dto.category ?? 'custom',
      department:       dto.department ?? null,
      color:            dto.color ?? null,
      recurrenceType:   dto.recurrence_type,
      dayOfMonth:       dto.day_of_month ?? null,
      dayOfWeek:        dto.day_of_week ?? null,
      monthOfYear:      dto.month_of_year ?? null,
      notifyBeforeDays: dto.notify_before_days ?? [],
      notifyEmails:     dto.notify_emails ?? [],
      notifyByPush:     dto.notify_by_push ?? true,
      isActive:         dto.is_active ?? true,
    });
    return { success: true, data: await this.recurringRepo.save(ev) };
  }

  async updateRecurringEvent(user: AuthenticatedUser, id: string, dto: UpdateRecurringEventDto) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const ev = await this.recurringRepo.findOne({
      where: { id, companyId: user.companyId, deletedAt: IsNull() },
    });
    if (!ev) throw new NotFoundException();
    if (dto.title !== undefined)             ev.title            = dto.title;
    if (dto.description !== undefined)       ev.description      = dto.description ?? null;
    if (dto.category !== undefined)          ev.category         = dto.category;
    if (dto.department !== undefined)        ev.department       = dto.department ?? null;
    if (dto.color !== undefined)             ev.color            = dto.color ?? null;
    if (dto.recurrence_type !== undefined)   ev.recurrenceType   = dto.recurrence_type;
    if (dto.day_of_month !== undefined)      ev.dayOfMonth       = dto.day_of_month ?? null;
    if (dto.day_of_week !== undefined)       ev.dayOfWeek        = dto.day_of_week ?? null;
    if (dto.month_of_year !== undefined)     ev.monthOfYear      = dto.month_of_year ?? null;
    if (dto.notify_before_days !== undefined) ev.notifyBeforeDays = dto.notify_before_days;
    if (dto.notify_emails !== undefined)     ev.notifyEmails     = dto.notify_emails;
    if (dto.notify_by_push !== undefined)    ev.notifyByPush     = dto.notify_by_push;
    if (dto.is_active !== undefined)         ev.isActive         = dto.is_active;
    return { success: true, data: await this.recurringRepo.save(ev) };
  }

  async deleteRecurringEvent(user: AuthenticatedUser, id: string) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();
    const ev = await this.recurringRepo.findOne({ where: { id, companyId: user.companyId } });
    if (!ev) throw new NotFoundException();
    await this.recurringRepo.softDelete(id);
    return { success: true };
  }

  // ─── 이번 달/다음 달 예정 일정 생성 (캘린더 통합용) ────────────────────────
  async getUpcomingRecurring(user: AuthenticatedUser, days = 60) {
    const events = await this.recurringRepo.find({
      where: { companyId: user.companyId, isActive: true, deletedAt: IsNull() },
    });

    const today = new Date();
    const until = addDays(today, days);
    const occurrences: Array<{
      id: string; title: string; category: string; color: string | null;
      department: string | null; date: string;
    }> = [];

    for (const ev of events) {
      const dates = this.computeOccurrences(ev, today, until);
      for (const d of dates) {
        occurrences.push({
          id: ev.id, title: ev.title, category: ev.category,
          color: ev.color, department: ev.department,
          date: format(d, 'yyyy-MM-dd'),
        });
      }
    }

    occurrences.sort((a, b) => a.date.localeCompare(b.date));
    return { success: true, data: occurrences };
  }

  // ═══════════════════════════════════════════════════════════
  // 팀별 화면 가시성
  // ═══════════════════════════════════════════════════════════

  getDeptTemplates() {
    return {
      success: true,
      data: Object.entries(DEPT_TEMPLATES).map(([key, t]) => ({
        key, name: t.name, emoji: t.emoji,
        visible: t.visible,
        hasRecurringEvents: !!(t.recurringEvents?.length),
      })),
    };
  }

  async getVisibility(user: AuthenticatedUser) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException('관리자 전용입니다.');
    const rows = await this.visibilityRepo.find({ where: { companyId: user.companyId } });
    // 부서별로 그룹화
    const byDept: Record<string, Record<string, boolean>> = {};
    for (const r of rows) {
      if (!byDept[r.department]) byDept[r.department] = {};
      byDept[r.department][r.pageKey] = r.isVisible;
    }
    return { success: true, data: { byDepartment: byDept, templates: Object.keys(DEPT_TEMPLATES) } };
  }

  async getMyVisibility(user: AuthenticatedUser) {
    // owner는 항상 전체 표시
    if (user.role === UserRole.OWNER) {
      return { success: true, data: Object.fromEntries(ALL_PAGE_KEYS.map(k => [k, true])) };
    }

    // 내 부서 조회
    const me = await this.userRepo.findOne({ where: { id: user.id }, select: ['department'] });
    const dept = me?.department ?? null;

    // 부서별 설정 우선, 없으면 기본값 확인
    const deptRows = dept
      ? await this.visibilityRepo.find({ where: { companyId: user.companyId, department: dept } })
      : [];
    const defaultRows = await this.visibilityRepo.find({
      where: { companyId: user.companyId, department: '__default__' },
    });

    const map: Record<string, boolean> = {};
    for (const key of ALL_PAGE_KEYS) map[key] = true; // default all visible
    for (const r of defaultRows) map[r.pageKey] = r.isVisible;
    for (const r of deptRows)    map[r.pageKey] = r.isVisible; // dept overrides default

    // manager: calendar-settings 항상 표시
    if (user.role === UserRole.MANAGER) map['/calendar-settings'] = true;

    return { success: true, data: map };
  }

  async setDepartmentVisibility(user: AuthenticatedUser, dto: SetDepartmentVisibilityDto) {
    if (user.role === UserRole.EMPLOYEE) throw new ForbiddenException();

    for (const page of dto.pages) {
      await this.visibilityRepo
        .createQueryBuilder()
        .insert()
        .into(DepartmentPageVisibility)
        .values({
          companyId:    user.companyId,
          department:   dto.department,
          pageKey:      page.page_key,
          isVisible:    page.is_visible,
          updatedById:  user.id,
        })
        .orUpdate(['is_visible', 'updated_by_id', 'updated_at'], ['company_id', 'department', 'page_key'])
        .execute();
    }
    return { success: true };
  }

  async applyTemplate(user: AuthenticatedUser, dto: ApplyTemplateDto) {
    if (user.role !== UserRole.OWNER) throw new ForbiddenException('사업주만 템플릿을 적용할 수 있습니다.');

    const tmpl = DEPT_TEMPLATES[dto.template];
    if (!tmpl) throw new NotFoundException('템플릿을 찾을 수 없습니다.');

    // 가시성 설정
    const pages: Array<{ page_key: string; is_visible: boolean }> = ALL_PAGE_KEYS.map((k) => ({
      page_key:   k,
      is_visible: tmpl.visible === 'all' ? true : (tmpl.visible as string[]).includes(k),
    }));

    await this.setDepartmentVisibility(user, { department: dto.department, pages });

    // 반복 일정 생성 (선택)
    if (dto.create_recurring_events && tmpl.recurringEvents) {
      for (const re of tmpl.recurringEvents) {
        // 이미 같은 제목+부서 존재 시 스킵
        const exists = await this.recurringRepo.findOne({
          where: { companyId: user.companyId, title: re.title, department: dto.department, deletedAt: IsNull() },
        });
        if (exists) continue;

        await this.recurringRepo.save(this.recurringRepo.create({
          companyId:        user.companyId,
          createdById:      user.id,
          title:            re.title,
          category:         re.category,
          department:       dto.department,
          color:            re.color,
          recurrenceType:   re.recurrenceType,
          dayOfMonth:       re.dayOfMonth ?? null,
          monthOfYear:      re.monthOfYear ?? null,
          notifyBeforeDays: re.notifyBeforeDays,
          notifyEmails:     [],
          notifyByPush:     true,
          isActive:         true,
        }));
      }
    }

    return { success: true, message: `${tmpl.name} 템플릿이 적용되었습니다.` };
  }

  // ═══════════════════════════════════════════════════════════
  // Cron: 매일 오전 8시 — 이메일 리마인더 발송
  // ═══════════════════════════════════════════════════════════
  @Cron('0 8 * * *', { timeZone: 'Asia/Seoul' })
  async sendDailyReminders() {
    this.logger.log('캘린더 반복 일정 리마인더 발송 시작');
    const today = new Date();

    // 활성화된 모든 반복 일정 조회
    const events = await this.recurringRepo
      .createQueryBuilder('ev')
      .where('ev.is_active = true')
      .andWhere('ev.deleted_at IS NULL')
      .andWhere("ev.notify_before_days != '[]'::jsonb")
      .getMany();

    for (const ev of events) {
      for (const daysBefore of ev.notifyBeforeDays) {
        const targetDate = addDays(today, daysBefore);
        const occurrences = this.computeOccurrences(ev, targetDate, addDays(targetDate, 1));
        if (!occurrences.length) continue;

        const dateLabel = format(occurrences[0], 'M월 d일');
        const subject   = `[관리왕] ${dateLabel} 예정 — ${ev.title}`;
        const html      = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#2563EB">📅 ${ev.title}</h2>
            <p>안녕하세요.</p>
            <p><strong>${dateLabel}(${daysBefore}일 후)</strong>에 아래 일정이 예정되어 있습니다.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr><td style="padding:8px;background:#F3F4F6;font-weight:600">일정</td><td style="padding:8px">${ev.title}</td></tr>
              ${ev.description ? `<tr><td style="padding:8px;background:#F3F4F6;font-weight:600">내용</td><td style="padding:8px">${ev.description}</td></tr>` : ''}
              <tr><td style="padding:8px;background:#F3F4F6;font-weight:600">일자</td><td style="padding:8px">${dateLabel}</td></tr>
              ${ev.department ? `<tr><td style="padding:8px;background:#F3F4F6;font-weight:600">대상 팀</td><td style="padding:8px">${ev.department}</td></tr>` : ''}
            </table>
            <p style="color:#6B7280;font-size:12px">관리왕 캘린더 설정에서 알림을 조정할 수 있습니다.</p>
          </div>
        `;

        // 등록된 이메일로 발송
        for (const email of ev.notifyEmails) {
          // 이메일 주소로 사용자 찾기
          const targetUser = await this.userRepo
            .createQueryBuilder('u')
            .where('u.company_id = :cid', { cid: ev.companyId })
            .andWhere('u.deleted_at IS NULL')
            .select(['u.id', 'u.companyId'])
            .getOne();

          if (targetUser) {
            await this.notificationsService.dispatch({
              userId:    targetUser.id,
              companyId: ev.companyId,
              type:      'tax_deadline' as any,
              title:     `${daysBefore}일 후 — ${ev.title}`,
              body:      `${dateLabel}에 "${ev.title}" 일정이 있습니다.`,
              email:     { to: email, subject, html },
            }).catch(() => {});
          }
        }
      }
    }
    this.logger.log('캘린더 반복 일정 리마인더 발송 완료');
  }

  // ─── 헬퍼: 다음 발생 날짜 계산 ────────────────────────────────────────────
  private computeOccurrences(ev: RecurringCalendarEvent, from: Date, until: Date): Date[] {
    const results: Date[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);

    const end = new Date(until);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
      if (this.matchesRecurrence(ev, cursor)) {
        results.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return results;
  }

  private matchesRecurrence(ev: RecurringCalendarEvent, date: Date): boolean {
    const dom  = getDate(date);   // 1-31
    const dow  = getDay(date);    // 0=일...6=토
    const moy  = getMonth(date) + 1; // 1-12

    switch (ev.recurrenceType) {
      case 'monthly':
        return ev.dayOfMonth !== null && dom === ev.dayOfMonth;
      case 'weekly':
        return ev.dayOfWeek !== null && dow === ev.dayOfWeek;
      case 'quarterly':
        return !!(ev.monthOfYear?.includes(moy) && ev.dayOfMonth !== null && dom === ev.dayOfMonth);
      case 'yearly':
        return !!(ev.monthOfYear?.includes(moy) && ev.dayOfMonth !== null && dom === ev.dayOfMonth);
      default:
        return false;
    }
  }
}
