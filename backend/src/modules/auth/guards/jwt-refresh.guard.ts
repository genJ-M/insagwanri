import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Refresh Token 검증 가드
 * POST /auth/refresh 엔드포인트에서만 사용합니다.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Refresh Token이 만료되었습니다. 다시 로그인하세요.');
      }
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }
    return user;
  }
}
