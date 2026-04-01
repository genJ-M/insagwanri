import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { EvaluationCycle } from '../../database/entities/evaluation-cycle.entity';
import { Evaluation } from '../../database/entities/evaluation.entity';
import { EvaluationAnswer } from '../../database/entities/evaluation-answer.entity';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvaluationCycle, Evaluation, EvaluationAnswer, User])],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}
