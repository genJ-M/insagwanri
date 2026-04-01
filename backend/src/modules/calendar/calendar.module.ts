import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarEvent } from '../../database/entities/calendar-event.entity';
import { User } from '../../database/entities/user.entity';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent, User, AttendanceRecord])],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
