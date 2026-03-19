import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminAuditLog } from '../../database/entities/admin-audit-log.entity';
import { AdminJwtPayload } from '../types/admin-jwt-payload.type';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // GET / OPTIONS 는 감사 불필요
    if (['GET', 'OPTIONS', 'HEAD'].includes(method)) {
      return next.handle();
    }

    const user = request.user as AdminJwtPayload | undefined;
    const ip = request.ip || request.headers['x-forwarded-for'] || '0.0.0.0';

    // URL 파싱으로 action과 target 추론
    const urlParts = request.url.split('/').filter(Boolean);
    // /admin/v1/{resource}/{id?}
    const resourceIndex = urlParts.indexOf('v1') + 1;
    const resource = urlParts[resourceIndex] || 'unknown';
    const targetId = urlParts[resourceIndex + 1] || null;

    const action = `${resource}.${method.toLowerCase()}`;

    return next.handle().pipe(
      tap(() => {
        // 비동기로 감사 로그 저장 (실패해도 응답에 영향 없음)
        this.auditLogRepository.save(
          this.auditLogRepository.create({
            adminUserId: user?.sub ?? null,
            action,
            targetType: resource,
            targetId: targetId && this.isUuid(targetId) ? targetId : null,
            afterData: request.body || null,
            ipAddress: Array.isArray(ip) ? ip[0] : ip,
          }),
        ).catch(() => {});
      }),
    );
  }

  private isUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }
}
