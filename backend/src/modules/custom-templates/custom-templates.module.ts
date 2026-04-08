import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomTemplate } from '../../database/entities/custom-template.entity';
import { CustomTemplatesController } from './custom-templates.controller';
import { CustomTemplatesService } from './custom-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomTemplate])],
  controllers: [CustomTemplatesController],
  providers: [CustomTemplatesService],
  exports: [CustomTemplatesService],
})
export class CustomTemplatesModule {}
