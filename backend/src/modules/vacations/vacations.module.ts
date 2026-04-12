import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationsController } from './vacations.controller';
import { VacationsService } from './vacations.service';
import { VacationRequest } from '../../database/entities/vacation-request.entity';
import { VacationBalance } from '../../database/entities/vacation-balance.entity';
import { User } from '../../database/entities/user.entity';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [TypeOrmModule.forFeature([VacationRequest, VacationBalance, User]), TeamsModule],
  controllers: [VacationsController],
  providers: [VacationsService],
  exports: [VacationsService],
})
export class VacationsModule {}
