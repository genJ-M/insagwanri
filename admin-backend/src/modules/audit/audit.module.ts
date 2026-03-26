import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AdminAuditLog } from '../../database/entities/admin-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLog])],
  controllers: [AuditController],
})
export class AuditModule {}
