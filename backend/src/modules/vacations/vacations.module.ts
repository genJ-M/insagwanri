import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationsController } from './vacations.controller';
import { VacationsService } from './vacations.service';
import { VacationLeaveAlertService } from './vacation-leave-alert.service';
import { VacationRequest } from '../../database/entities/vacation-request.entity';
import { VacationBalance } from '../../database/entities/vacation-balance.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { AttendanceRecord } from '../../database/entities/attendance-record.entity';
import { TeamsModule } from '../teams/teams.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VacationRequest, VacationBalance, User, Company, AttendanceRecord]),
    TeamsModule,
    NotificationsModule,
  ],
  controllers: [VacationsController],
  providers: [VacationsService, VacationLeaveAlertService],
  exports: [VacationsService],
})
export class VacationsModule {}
