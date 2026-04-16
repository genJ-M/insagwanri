import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceArchiveService } from './attendance-archive.service';
import { AttendanceReminderService } from './attendance-reminder.service';
import { WeeklyHolidayPayCronService } from './weekly-holiday-pay-cron.service';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { TeamsModule } from '../teams/teams.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([AttendanceRecord, User, Company]), TeamsModule, NotificationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceArchiveService, AttendanceReminderService, WeeklyHolidayPayCronService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
