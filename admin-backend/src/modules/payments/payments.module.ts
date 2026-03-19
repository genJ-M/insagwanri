import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../../database/entities/payment.entity';
import { PaymentMethod } from '../../database/entities/payment-method.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TossPaymentsService } from './toss-payments.service';
import { DunningScheduler } from './dunning.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentMethod, Subscription]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, TossPaymentsService, DunningScheduler],
  exports: [PaymentsService, TossPaymentsService],
})
export class PaymentsModule {}
