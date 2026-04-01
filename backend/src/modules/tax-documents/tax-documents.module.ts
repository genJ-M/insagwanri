import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxDocumentsController } from './tax-documents.controller';
import { TaxDocumentsService } from './tax-documents.service';
import { TaxAlertService } from './tax-alert.service';
import { Salary } from '../../database/entities/salary.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Salary, User, Company]),
    NotificationsModule,
  ],
  controllers: [TaxDocumentsController],
  providers: [TaxDocumentsService, TaxAlertService],
  exports: [TaxDocumentsService],
})
export class TaxDocumentsModule {}
