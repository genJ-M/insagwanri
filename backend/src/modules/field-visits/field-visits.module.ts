import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldLocation } from '../../database/entities/field-location.entity';
import { FieldVisit } from '../../database/entities/field-visit.entity';
import { Task } from '../../database/entities/task.entity';
import { Company } from '../../database/entities/company.entity';
import { FieldVisitsService } from './field-visits.service';
import { FieldVisitsController } from './field-visits.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FieldLocation, FieldVisit, Task, Company]),
    NotificationsModule,
  ],
  controllers: [FieldVisitsController],
  providers: [FieldVisitsService],
  exports: [FieldVisitsService],
})
export class FieldVisitsModule {}
