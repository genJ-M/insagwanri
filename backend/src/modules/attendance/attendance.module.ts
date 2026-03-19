import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceArchiveService } from './attendance-archive.service';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord, User, Company])],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceArchiveService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
