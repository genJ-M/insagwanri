import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftSwapRequest } from '../../database/entities/shift-swap-request.entity';
import { ShiftAssignment } from '../../database/entities/shift-schedule.entity';
import { User } from '../../database/entities/user.entity';
import { ShiftSwapService } from './shift-swap.service';
import { ShiftSwapController } from './shift-swap.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShiftSwapRequest, ShiftAssignment, User]),
    NotificationsModule,
  ],
  providers: [ShiftSwapService],
  controllers: [ShiftSwapController],
  exports: [ShiftSwapService],
})
export class ShiftSwapModule {}
