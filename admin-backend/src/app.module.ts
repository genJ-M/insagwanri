import { Module, APP_INTERCEPTOR } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Entities
import { AdminUser } from './database/entities/admin-user.entity';
import { AdminAuditLog } from './database/entities/admin-audit-log.entity';
import { Plan } from './database/entities/plan.entity';
import { Contract } from './database/entities/contract.entity';
import { Subscription } from './database/entities/subscription.entity';
import { BillingProfile } from './database/entities/billing-profile.entity';
import { PaymentMethod } from './database/entities/payment-method.entity';
import { Payment } from './database/entities/payment.entity';
import { Coupon } from './database/entities/coupon.entity';
import { TaxInvoice } from './database/entities/tax-invoice.entity';
import { ServiceUsage } from './database/entities/service-usage.entity';
import { ExportLog } from './database/entities/export-log.entity';
import { Feature } from './database/entities/feature.entity';
import { CompanyFeature } from './database/entities/company-feature.entity';

// Modules
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { PlansModule } from './modules/plans/plans.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';

// Interceptors / Filters
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'gwanriwang'),
        entities: [
          AdminUser, AdminAuditLog, Plan, Contract, Subscription,
          BillingProfile, PaymentMethod, Payment, Coupon, TaxInvoice,
          ServiceUsage, ExportLog, Feature, CompanyFeature,
        ],
        migrations: ['dist/database/migrations/*.js'],
        synchronize: false,
        logging: config.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),

    // AuditInterceptor(APP_INTERCEPTOR)가 AdminAuditLog 리포지토리를 주입받으려면
    // forRootAsync 다음에 forFeature를 등록해야 함
    TypeOrmModule.forFeature([AdminAuditLog]),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 60 }, // 60req/분 (관리자 내부망)
    ]),

    AdminAuthModule,
    AdminUsersModule,
    CompaniesModule,
    PlansModule,
    PaymentsModule,
    FeatureFlagsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
