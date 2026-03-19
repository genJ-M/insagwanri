import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { Company } from '../../database/entities/company.entity';
import { User } from '../../database/entities/user.entity';
import { EmailVerification } from '../../database/entities/email-verification.entity';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoginLockService } from './services/login-lock.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
    }),
    TypeOrmModule.forFeature([Company, User, EmailVerification, PasswordResetToken]),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, LoginLockService],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
