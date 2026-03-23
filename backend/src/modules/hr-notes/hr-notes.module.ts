import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrNotesController } from './hr-notes.controller';
import { HrNotesService } from './hr-notes.service';
import { HrNote } from '../../database/entities/hr-note.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HrNote])],
  controllers: [HrNotesController],
  providers: [HrNotesService],
  exports: [HrNotesService],
})
export class HrNotesModule {}
