import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionBillingCronService } from './subscription-billing-cron.service';
import { SubscriptionNotifyCronService } from './subscription-notify-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionBillingCronService,
    SubscriptionNotifyCronService,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
