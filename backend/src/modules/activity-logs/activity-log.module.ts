import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogService } from './activity-log.service';
import { CryptoMigrationService } from './crypto-migration.service';
import { UserActivityLog } from '../../database/entities/user-activity-log.entity';
import { User } from '../../database/entities/user.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserActivityLog, User])],
  providers: [ActivityLogService, CryptoMigrationService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
