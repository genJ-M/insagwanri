import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftSchedule, ShiftAssignment } from '../../database/entities/shift-schedule.entity';
import { EmployeeAvailability } from '../../database/entities/employee-availability.entity';
import { User } from '../../database/entities/user.entity';
import { ShiftScheduleController } from './shift-schedule.controller';
import { ShiftScheduleService } from './shift-schedule.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftSchedule, ShiftAssignment,
      EmployeeAvailability,
      User,
    ]),
    NotificationsModule,
    TeamsModule,
  ],
  controllers: [ShiftScheduleController],
  providers: [ShiftScheduleService],
  exports: [ShiftScheduleService],
})
export class ShiftScheduleModule {}
