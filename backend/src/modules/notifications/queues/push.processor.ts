import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { ConfigService } from '@nestjs/config';
import { DeviceToken } from '../../../database/entities/device-token.entity';

export interface PushJob {
  userId: string;
  title: string;
  body: string;
  data: {
    refType?: string;
    refId?: string;
    notificationId: string;
  };
  notificationId: string;
}

@Processor('push-queue')
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);
  private readonly expo: Expo;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
  ) {
    super();
    this.expo = new Expo({
      accessToken: configService.get<string>('EXPO_ACCESS_TOKEN'),
    });
  }

  async process(job: Job<PushJob>): Promise<void> {
    const { userId, title, body, data } = job.data;

    const tokens = await this.deviceTokenRepo.find({
      where: { userId, isActive: true },
    });

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        title,
        body,
        data,
        sound: 'default' as const,
      }));

    if (messages.length === 0) return;

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const receipts = await this.expo.sendPushNotificationsAsync(chunk);

      // 무효화된 토큰 비활성화
      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        if (
          receipt.status === 'error' &&
          receipt.details?.error === 'DeviceNotRegistered'
        ) {
          await this.deviceTokenRepo.update(
            { token: tokens[i].token },
            { isActive: false },
          );
        }
      }
    }

    this.logger.log(
      `푸시 발송 완료: userId=${userId}, tokens=${messages.length}`,
    );
  }
}
