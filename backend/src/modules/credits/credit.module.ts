import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { Credit, CreditTransaction } from '../../database/entities/credit.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Credit, CreditTransaction])],
  controllers: [CreditController],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}
