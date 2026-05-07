import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { Schedule } from '../../database/entities/schedule.entity';
import { ScheduleShare } from '../../database/entities/schedule-share.entity';
import { ScheduleShareRequest } from '../../database/entities/schedule-share-request.entity';
import { User } from '../../database/entities/user.entity';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Schedule,
      ScheduleShare,
      ScheduleShareRequest,
      User,
      AttendanceRecord,
    ]),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
