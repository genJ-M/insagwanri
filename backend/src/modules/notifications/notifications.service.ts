import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Notification,
  NotificationType,
  NotificationRefType,
} from '../../database/entities/notification.entity';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { NotificationSettings } from '../../database/entities/notification-settings.entity';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';
import {
  NotificationQueryDto,
  UpdateNotificationSettingsDto,
  RegisterDeviceTokenDto,
} from './dto/notifications.dto';
import { EmailJob } from './queues/email.processor';
import { PushJob } from './queues/push.processor';

export interface DispatchOptions {
  userId: string;
  companyId: string;
  type: NotificationType;
  title: string;
  body: string;
  refType?: NotificationRefType;
  refId?: string;
  email?: {
    to: string;
    subject: string;
    html: string;
  };
}

// DND 체크: KST 기준 방해금지 시간대 여부
function isInDnd(
  settings: NotificationSettings,
  nowKst: Date,
): boolean {
  if (!settings.dndEnabled) return false;

  const [startH, startM] = settings.dndStartTime.split(':').map(Number);
  const [endH, endM] = settings.dndEndTime.split(':').map(Number);
  const nowMin = nowKst.getHours() * 60 + nowKst.getMinutes();
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  // 자정을 넘어가는 범위 (ex. 22:00 ~ 08:00)
  if (startMin > endMin) {
    return nowMin >= startMin || nowMin < endMin;
  }
  return nowMin >= startMin && nowMin < endMin;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,

    @InjectRepository(NotificationSettings)
    private readonly settingsRepo: Repository<NotificationSettings>,

    @InjectQueue('email-queue')
    private readonly emailQueue: Queue<EmailJob>,

    @InjectQueue('push-queue')
    private readonly pushQueue: Queue<PushJob>,
  ) {}

  // ─────────────────────────────────────────
  // 알림 발송 (핵심 메서드)
  // ─────────────────────────────────────────
  async dispatch(options: DispatchOptions): Promise<void> {
    // 1. DB 저장 (항상 먼저)
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        companyId: options.companyId,
        userId: options.userId,
        type: options.type,
        title: options.title,
        body: options.body,
        refType: options.refType ?? null,
        refId: options.refId ?? null,
        isRead: false,
      }),
    );

    // 2. 알림 설정 조회 (없으면 기본값 사용)
    const settings = await this.getOrCreateSettings(
      options.userId,
      options.companyId,
    );

    // 3. 푸시 알림 큐
    if (settings.pushEnabled && this.shouldSendPush(settings, options.type)) {
      const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const dndDelay = isInDnd(settings, nowKst)
        ? this.msUntilDndEnd(settings, nowKst)
        : 0;

      await this.pushQueue.add(
        'send-push',
        {
          userId: options.userId,
          title: options.title,
          body: options.body,
          data: {
            refType: options.refType,
            refId: options.refId,
            notificationId: notification.id,
          },
          notificationId: notification.id,
        },
        {
          delay: dndDelay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
    }

    // 4. 이메일 큐
    if (options.email && settings.emailEnabled) {
      await this.emailQueue.add(
        'send-email',
        {
          templateName: options.type,
          to: options.email.to,
          subject: options.email.subject,
          html: options.email.html,
          notificationId: notification.id,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      );
    }
  }

  // ─────────────────────────────────────────
  // 인앱 알림 목록
  // ─────────────────────────────────────────
  async findAll(currentUser: AuthenticatedUser, query: NotificationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: any = {
      userId: currentUser.id,
      companyId: currentUser.companyId,
    };
    if (query.unreadOnly) where.isRead = false;

    const [items, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { userId: currentUser.id, companyId: currentUser.companyId, isRead: false },
    });

    return {
      items,
      meta: {
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─────────────────────────────────────────
  // 미읽음 개수
  // ─────────────────────────────────────────
  async getUnreadCount(currentUser: AuthenticatedUser): Promise<number> {
    return this.notificationRepo.count({
      where: {
        userId: currentUser.id,
        companyId: currentUser.companyId,
        isRead: false,
      },
    });
  }

  // ─────────────────────────────────────────
  // 단건 읽음 처리
  // ─────────────────────────────────────────
  async markRead(currentUser: AuthenticatedUser, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: {
        id: notificationId,
        userId: currentUser.id,
        companyId: currentUser.companyId,
      },
    });
    if (!notification) throw new NotFoundException('알림을 찾을 수 없습니다.');

    await this.notificationRepo.update(notification.id, {
      isRead: true,
      readAt: new Date(),
    });
  }

  // ─────────────────────────────────────────
  // 전체 읽음 처리
  // ─────────────────────────────────────────
  async markAllRead(currentUser: AuthenticatedUser) {
    await this.notificationRepo
      .createQueryBuilder()
      .update()
      .set({ isRead: true, readAt: new Date() })
      .where('user_id = :userId', { userId: currentUser.id })
      .andWhere('company_id = :companyId', { companyId: currentUser.companyId })
      .andWhere('is_read = false')
      .execute();
  }

  // ─────────────────────────────────────────
  // 알림 삭제
  // ─────────────────────────────────────────
  async delete(currentUser: AuthenticatedUser, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: {
        id: notificationId,
        userId: currentUser.id,
        companyId: currentUser.companyId,
      },
    });
    if (!notification) throw new NotFoundException('알림을 찾을 수 없습니다.');
    await this.notificationRepo.remove(notification);
  }

  // ─────────────────────────────────────────
  // 알림 설정 조회
  // ─────────────────────────────────────────
  async getSettings(currentUser: AuthenticatedUser) {
    return this.getOrCreateSettings(currentUser.id, currentUser.companyId);
  }

  // ─────────────────────────────────────────
  // 알림 설정 수정
  // ─────────────────────────────────────────
  async updateSettings(
    currentUser: AuthenticatedUser,
    dto: UpdateNotificationSettingsDto,
  ) {
    const settings = await this.getOrCreateSettings(
      currentUser.id,
      currentUser.companyId,
    );

    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  // ─────────────────────────────────────────
  // 디바이스 토큰 등록 (upsert)
  // ─────────────────────────────────────────
  async registerDeviceToken(
    currentUser: AuthenticatedUser,
    dto: RegisterDeviceTokenDto,
  ) {
    const existing = await this.deviceTokenRepo.findOne({
      where: { userId: currentUser.id, token: dto.token },
    });

    if (existing) {
      await this.deviceTokenRepo.update(existing.id, {
        isActive: true,
        lastUsedAt: new Date(),
        appVersion: dto.appVersion ?? existing.appVersion,
        deviceName: dto.deviceName ?? existing.deviceName,
      });
    } else {
      await this.deviceTokenRepo.save(
        this.deviceTokenRepo.create({
          userId: currentUser.id,
          companyId: currentUser.companyId,
          token: dto.token,
          platform: dto.platform,
          deviceName: dto.deviceName ?? null,
          appVersion: dto.appVersion ?? null,
          isActive: true,
          lastUsedAt: new Date(),
        }),
      );
    }
  }

  // ─────────────────────────────────────────
  // 디바이스 토큰 삭제 (로그아웃)
  // ─────────────────────────────────────────
  async removeDeviceToken(currentUser: AuthenticatedUser, token: string) {
    await this.deviceTokenRepo.update(
      { userId: currentUser.id, token },
      { isActive: false },
    );
  }

  // ─────────────────────────────────────────
  // 90일 초과 알림 정리 (크론에서 호출)
  // ─────────────────────────────────────────
  async cleanOldNotifications() {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute();
    this.logger.log(`알림 정리: ${result.affected}건 삭제`);
  }

  // ─────────────────────────────────────────
  // 내부 유틸
  // ─────────────────────────────────────────
  private async getOrCreateSettings(
    userId: string,
    companyId: string,
  ): Promise<NotificationSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });
    if (!settings) {
      settings = this.settingsRepo.create({ userId, companyId });
      await this.settingsRepo.save(settings);
    }
    return settings;
  }

  private shouldSendPush(
    settings: NotificationSettings,
    type: NotificationType,
  ): boolean {
    if (type.startsWith('task_')) return settings.pushTask;
    if (type.startsWith('message_') || type === 'channel_announcement')
      return settings.pushMessage;
    if (type.startsWith('schedule_')) return settings.pushSchedule;
    if (type.startsWith('attendance_')) return settings.pushAttendance;
    return true;
  }

  private msUntilDndEnd(settings: NotificationSettings, nowKst: Date): number {
    const [endH, endM] = settings.dndEndTime.split(':').map(Number);
    const end = new Date(nowKst);
    end.setHours(endH, endM, 0, 0);
    if (end <= nowKst) end.setDate(end.getDate() + 1);
    return end.getTime() - nowKst.getTime();
  }
}
