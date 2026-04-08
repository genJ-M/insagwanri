import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CalendarSettingsController } from './calendar-settings.controller';
import { CalendarSettingsService } from './calendar-settings.service';
import { RecurringCalendarEvent } from '../../database/entities/recurring-calendar-event.entity';
import { DepartmentPageVisibility } from '../../database/entities/department-page-visibility.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringCalendarEvent, DepartmentPageVisibility, User]),
    ScheduleModule,
    NotificationsModule,
  ],
  controllers: [CalendarSettingsController],
  providers: [CalendarSettingsService],
  exports: [CalendarSettingsService],
})
export class CalendarSettingsModule {}
