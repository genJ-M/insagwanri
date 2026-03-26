import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Subscription } from '../../database/entities/subscription.entity';
import { Plan } from '../../database/entities/plan.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Plan]),
    JwtModule.register({}), // 동적 secret 사용 — signOptions는 서비스에서 직접 지정
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
