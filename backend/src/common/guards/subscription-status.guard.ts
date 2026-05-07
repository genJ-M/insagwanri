import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ALLOW_EXPIRED_KEY } from '../decorators/allow-expired.decorator';
import { AuthenticatedUser } from '../types/jwt-payload.type';

/**
 * 구독 상태 가드 — expired / suspended 상태인 회사의 핵심 기능 접근 차단.
 * JwtAuthGuard 이후, ModuleAccessGuard 전에 실행.
 *
 * 통과 조건 (어느 하나라도 충족):
 *  1) 인증되지 않은 요청 (Public 라우트) — JwtAuthGuard에서 이미 처리됨
 *  2) @AllowExpired() 데코레이터가 붙은 핸들러
 *  3) URL prefix 화이트리스트 (결제/계정/알림 등 expired 상태에서도 필수)
 *  4) 회사의 subscription.status가 active / trialing / past_due 중 하나
 *
 * 차단 시: 403 + code: 'SUBSCRIPTION_EXPIRED' — 프론트에서 /billing으로 유도
 */
@Injectable()
export class SubscriptionStatusGuard implements CanActivate {
  /**
   * expired 상태에서도 항상 접근 허용하는 URL prefix.
   * 결제 처리, 사용자/회사 정보 조회, 알림 확인 등은 expired 상태에서도 가능해야
   * 사용자가 다시 결제하거나 무료 플랜으로 전환할 수 있다.
   */
  private readonly ALLOWED_PREFIXES = [
    '/auth',          // 로그인/로그아웃/토큰갱신
    '/subscriptions', // 결제 관리 (downgrade, upgrade, addSeats...)
    '/workspace',     // 회사 설정 조회
    '/users',         // 위임 계정 지정용 직원 목록 + 본인 정보
    '/notifications', // 알림 조회
    '/feedback',      // 사용자 피드백 (해지 사유 등)
    '/health',        // 헬스 체크
    '/companies',     // 회사 정보
    '/files',         // 첨부파일 다운로드 (결제 메일에서 받은 자료)
  ];

  /** 차단할 status — active / trialing / past_due 외 모든 상태는 차단 */
  private readonly BLOCKED_STATUSES = new Set(['expired', 'suspended', 'canceled']);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    // 1) 인증 정보 없으면 통과 (Public 라우트, JwtAuthGuard에서 이미 처리)
    if (!user?.companyId) return true;

    // 2) @AllowExpired() 데코레이터 — 명시 허용
    const allowExpired = this.reflector.getAllAndOverride<boolean>(
      ALLOW_EXPIRED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowExpired) return true;

    // 3) URL prefix 화이트리스트
    const url: string = request.url ?? '';
    // /api/v1/auth, /api/v1/subscriptions 등 prefix 매칭
    if (this.ALLOWED_PREFIXES.some((p) => url.includes(p))) return true;

    // 4) 회사 구독 상태 조회
    const [sub] = await this.dataSource.query(
      `SELECT status FROM subscriptions WHERE company_id = $1`,
      [user.companyId],
    );

    // 구독 정보 없으면 통과 (신규 회사 — Public 흐름에서 처리됨)
    if (!sub) return true;

    if (this.BLOCKED_STATUSES.has(sub.status)) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_EXPIRED',
        message:
          sub.status === 'expired'
            ? '무료 체험이 종료되어 이 기능을 사용할 수 없습니다. 결제하거나 무료 플랜으로 전환해 주세요.'
            : sub.status === 'canceled'
            ? '구독이 해지되어 이 기능을 사용할 수 없습니다.'
            : '구독이 일시 정지되어 이 기능을 사용할 수 없습니다.',
        status: sub.status,
      });
    }

    return true;
  }
}
