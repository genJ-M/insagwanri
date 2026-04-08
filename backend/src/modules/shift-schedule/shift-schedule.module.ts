import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftSchedule, ShiftAssignment } from '../../database/entities/shift-schedule.entity';
import { EmployeeAvailability } from '../../database/entities/employee-availability.entity';
import { Notification } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';
import { ShiftScheduleController } from './shift-schedule.controller';
import { ShiftScheduleService } from './shift-schedule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftSchedule, ShiftAssignment,
      EmployeeAvailability,
      Notification,
      User,
    ]),
  ],
  controllers: [ShiftScheduleController],
  providers: [ShiftScheduleService],
  exports: [ShiftScheduleService],
})
export class ShiftScheduleModule {}
