import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Task } from '../../database/entities/task.entity';
import { ApprovalDocument } from '../../database/entities/approval-document.entity';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Task, ApprovalDocument])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
