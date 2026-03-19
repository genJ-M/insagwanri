import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { EmailProcessor } from './queues/email.processor';
import { PushProcessor } from './queues/push.processor';
import { Notification } from '../../database/entities/notification.entity';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { NotificationSettings } from '../../database/entities/notification-settings.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification, DeviceToken, NotificationSettings]),
    BullModule.registerQueue(
      {
        name: 'email-queue',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      },
      {
        name: 'push-queue',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        },
      },
    ),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, EmailProcessor, PushProcessor],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
