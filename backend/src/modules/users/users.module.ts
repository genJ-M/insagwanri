import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../../database/entities/user.entity';
import { InviteToken } from '../../database/entities/invite-token.entity';
import { Company } from '../../database/entities/company.entity';
import { UserCareer } from '../../database/entities/user-career.entity';
import { UserEducation } from '../../database/entities/user-education.entity';
import { UserDocument } from '../../database/entities/user-document.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, InviteToken, Company, UserCareer, UserEducation, UserDocument]),
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
