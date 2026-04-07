import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarEvent } from '../../database/entities/calendar-event.entity';
import { CalendarEventShare } from '../../database/entities/calendar-event-share.entity';
import { CalendarShareRequest } from '../../database/entities/calendar-share-request.entity';
import { User } from '../../database/entities/user.entity';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarEvent,
      CalendarEventShare,
      CalendarShareRequest,
      User,
      AttendanceRecord,
    ]),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
