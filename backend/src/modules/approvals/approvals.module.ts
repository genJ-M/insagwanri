import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { DocumentSealService } from './document-seal.service';
import { ApprovalDocument } from '../../database/entities/approval-document.entity';
import { ApprovalStep } from '../../database/entities/approval-step.entity';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApprovalDocument, ApprovalStep, User, Company]),
    NotificationsModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, DocumentSealService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
