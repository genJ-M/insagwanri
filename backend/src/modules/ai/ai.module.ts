import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRequest } from '../../database/entities/ai-request.entity';
import { Company } from '../../database/entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiRequest, Company])],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],  // 다른 모듈에서 AI 기능 사용 시 주입 가능
})
export class AiModule {}
