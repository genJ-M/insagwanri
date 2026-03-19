import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

/**
 * JWT 인증 가드
 * @Public() 데코레이터가 있는 라우트는 인증을 건너뜁니다.
 *
 * AppModule 또는 각 컨트롤러에서 전역 적용 가능합니다.
 *
 * @example 전역 적용 (app.module.ts)
 * providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // @Public() 데코레이터가 있으면 인증 생략
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access Token이 만료되었습니다.');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('유효하지 않은 Access Token입니다.');
      }
      throw new UnauthorizedException('인증이 필요합니다.');
    }
    return user;
  }
}
