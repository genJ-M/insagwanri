import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponsController } from './coupons.controller';
import { Coupon } from '../../database/entities/coupon.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon])],
  controllers: [CouponsController],
})
export class CouponsModule {}
