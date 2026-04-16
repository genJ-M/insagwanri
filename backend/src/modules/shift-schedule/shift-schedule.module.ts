import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ShiftSchedule, ShiftAssignment } from '../../database/entities/shift-schedule.entity';
import { EmployeeAvailability } from '../../database/entities/employee-availability.entity';
import { ShiftHandover } from '../../database/entities/shift-handover.entity';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { ShiftScheduleController } from './shift-schedule.controller';
import { ShiftScheduleService } from './shift-schedule.service';
import { ShiftAbsentCronService } from './shift-absent-cron.service';
import { ShiftReminderCronService } from './shift-reminder-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftSchedule, ShiftAssignment,
      EmployeeAvailability,
      ShiftHandover,
      AttendanceRecord,
      User,
      Company,
    ]),
    ScheduleModule,
    NotificationsModule,
    TeamsModule,
  ],
  controllers: [ShiftScheduleController],
  providers: [ShiftScheduleService, ShiftAbsentCronService, ShiftReminderCronService],
  exports: [ShiftScheduleService],
})
export class ShiftScheduleModule {}
