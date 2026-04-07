import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { SocketModule } from './modules/socket/socket.module';
import { AiModule } from './modules/ai/ai.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FilesModule } from './modules/files/files.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SalaryModule } from './modules/salary/salary.module';
import { HrNotesModule } from './modules/hr-notes/hr-notes.module';
import { VacationsModule } from './modules/vacations/vacations.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { TrainingModule } from './modules/training/training.module';
import { TaxDocumentsModule } from './modules/tax-documents/tax-documents.module';
import { SearchModule } from './modules/search/search.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { CreditModule } from './modules/credits/credit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { SmsModule } from './common/sms/sms.module';
import { ActivityLogModule } from './modules/activity-logs/activity-log.module';
import { UserActivityLog } from './database/entities/user-activity-log.entity';
import { UserSubscriber } from './database/subscribers/user.subscriber';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import { Company } from './database/entities/company.entity';
import { User } from './database/entities/user.entity';
import { AttendanceRecord } from './database/entities/attendance-record.entity';
import { Task } from './database/entities/task.entity';
import { TaskReport } from './database/entities/task-report.entity';
import { Schedule } from './database/entities/schedule.entity';
import { Channel } from './database/entities/channel.entity';
import { ChannelMember } from './database/entities/channel-member.entity';
import { Message } from './database/entities/message.entity';
import { AiRequest } from './database/entities/ai-request.entity';
import { InviteToken } from './database/entities/invite-token.entity';
import { EmailVerification } from './database/entities/email-verification.entity';
import { PasswordResetToken } from './database/entities/password-reset-token.entity';
import { Notification } from './database/entities/notification.entity';
import { DeviceToken } from './database/entities/device-token.entity';
import { NotificationSettings } from './database/entities/notification-settings.entity';
import { File } from './database/entities/file.entity';
import { Salary } from './database/entities/salary.entity';
import { HrNote } from './database/entities/hr-note.entity';
import { VacationRequest } from './database/entities/vacation-request.entity';
import { VacationBalance } from './database/entities/vacation-balance.entity';
import { ApprovalDocument } from './database/entities/approval-document.entity';
import { ApprovalStep } from './database/entities/approval-step.entity';
import { Contract } from './database/entities/contract.entity';
import { CalendarEvent } from './database/entities/calendar-event.entity';
import { CalendarEventShare } from './database/entities/calendar-event-share.entity';
import { CalendarShareRequest } from './database/entities/calendar-share-request.entity';
import { EvaluationCycle } from './database/entities/evaluation-cycle.entity';
import { Evaluation } from './database/entities/evaluation.entity';
import { EvaluationAnswer } from './database/entities/evaluation-answer.entity';
import { UserCareer } from './database/entities/user-career.entity';
import { UserEducation } from './database/entities/user-education.entity';
import { UserDocument } from './database/entities/user-document.entity';
import { Training } from './database/entities/training.entity';
import { TrainingEnrollment } from './database/entities/training-enrollment.entity';
import { PhoneOtp } from './database/entities/phone-otp.entity';
import { Feedback } from './database/entities/feedback.entity';
import { Credit, CreditTransaction } from './database/entities/credit.entity';

@Module({
  imports: [
    // 전역 Winston 로거 (가장 먼저 등록)
    LoggerModule,

    // 환경변수 전역 로드 (다른 모듈보다 먼저)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 스케줄러 (@Cron 데코레이터 활성화)
    ScheduleModule.forRoot(),

    // 암호화 서비스 (전역 — ConfigModule 이후 등록)
    CryptoModule,

    // SMS 서비스 (전역)
    SmsModule,

    // Rate Limiting (전역)
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 120 },
    ]),

    // BullMQ (Redis 기반 작업 큐)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
    }),

    // TypeORM (PostgreSQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const base = {
          type: 'postgres' as const,
          entities: [
            Company, User,
            AttendanceRecord,
            Task, TaskReport,
            Schedule,
            Channel, ChannelMember, Message,
            AiRequest,
            InviteToken,
            EmailVerification, PasswordResetToken,
            Notification, DeviceToken, NotificationSettings,
            File,
            Salary,
            HrNote,
            VacationRequest,
            VacationBalance,
            ApprovalDocument,
            ApprovalStep,
            Contract,
            CalendarEvent,
            CalendarEventShare,
            CalendarShareRequest,
            EvaluationCycle,
            Evaluation,
            EvaluationAnswer,
            UserCareer,
            UserEducation,
            UserDocument,
            Training,
            TrainingEnrollment,
            UserActivityLog,
            PhoneOtp,
            Feedback,
            Credit,
            CreditTransaction,
          ],
          synchronize: false, // Migration으로 스키마 관리
          logging: config.get<string>('NODE_ENV') === 'development',
        };

        if (databaseUrl) {
          // DATABASE_URL 우선 사용 (Prisma, Railway, Heroku 등 클라우드 DB)
          return { ...base, url: databaseUrl, ssl: { rejectUnauthorized: false } };
        }

        return {
          ...base,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
          ssl:
            config.get<string>('NODE_ENV') === 'production'
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),

    AuthModule,
    UsersModule,
    WorkspaceModule,
    AttendanceModule,
    TasksModule,
    SchedulesModule,
    CollaborationModule,
    SocketModule,
    AiModule,
    HealthModule,
    NotificationsModule,
    FilesModule,
    SubscriptionsModule,
    SalaryModule,
    HrNotesModule,
    VacationsModule,
    ApprovalsModule,
    ContractsModule,
    CalendarModule,
    EvaluationsModule,
    TrainingModule,
    TaxDocumentsModule,
    SearchModule,
    FeedbackModule,
    CreditModule,

    // 활동 로그 (통신비밀보호법, 전역)
    ActivityLogModule,
  ],
  providers: [
    // Rate Limiting 전역 Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // JWT 인증 전역 적용 (@Public()이 없는 모든 라우트에 자동 적용)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 역할 체크 전역 적용 (@Roles()가 있는 라우트에만 동작)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // 전역 예외 필터 (등록 역순으로 실행 — AllExceptions가 마지막 방어선)
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,  // 비-HTTP 예외 (런타임 오류, DB 오류 등)
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,  // HTTP 예외 (4xx, 5xx)
    },
    // User 엔티티 투명 암호화 Subscriber
    UserSubscriber,

    // 전역 HTTP 요청 로깅 (응답 시간, 경로, 상태코드)
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // 전역 응답 인터셉터
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
