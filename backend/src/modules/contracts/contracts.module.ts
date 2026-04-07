import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract } from '../../database/entities/contract.entity';
import { User } from '../../database/entities/user.entity';
// CreditService는 @Global() CreditModule에서 전역 제공됨

@Module({
  imports: [TypeOrmModule.forFeature([Contract, User]), ConfigModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
