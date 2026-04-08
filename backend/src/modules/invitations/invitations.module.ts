import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InviteToken } from '../../database/entities/invite-token.entity';
import { User } from '../../database/entities/user.entity';
import { EmailVerification } from '../../database/entities/email-verification.entity';
import { Company } from '../../database/entities/company.entity';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InviteToken, User, EmailVerification, Company]),
    CryptoModule,
    NotificationsModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
