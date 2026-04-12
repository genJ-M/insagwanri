import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { Salary } from '../../database/entities/salary.entity';
import { User } from '../../database/entities/user.entity';
import { CalendarSettingsModule } from '../calendar-settings/calendar-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Salary, User]), CalendarSettingsModule],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
