import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3Service } from './s3.service';
import { FileValidatorService } from './file-validator.service';
import { S3CleanupScheduler } from './schedulers/s3-cleanup.scheduler';
import { File } from '../../database/entities/file.entity';
import { Company } from '../../database/entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([File, Company])],
  controllers: [FilesController],
  providers: [FilesService, S3Service, FileValidatorService, S3CleanupScheduler],
  exports: [FilesService, S3Service],
})
export class FilesModule {}
