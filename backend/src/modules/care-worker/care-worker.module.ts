import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CareLicense } from '../../database/entities/care-license.entity';
import { CareSession } from '../../database/entities/care-session.entity';
import { Company } from '../../database/entities/company.entity';
import { CareWorkerService } from './care-worker.service';
import { CareWorkerController } from './care-worker.controller';
import { CareLicenseCronService } from './care-license-cron.service';
import { CareFatigueCronService } from './care-fatigue-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CareLicense, CareSession, Company]),
    ScheduleModule,
    NotificationsModule,
  ],
  controllers: [CareWorkerController],
  providers: [CareWorkerService, CareLicenseCronService, CareFatigueCronService],
  exports: [CareWorkerService],
})
export class CareWorkerModule {}
