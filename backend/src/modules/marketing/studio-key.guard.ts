import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

/**
 * 마케팅 스튜디오 전용 Guard.
 * x-studio-key 헤더 값이 MARKETING_STUDIO_KEY 환경변수와 일치해야 통과.
 */
@Injectable()
export class StudioKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = req.headers['x-studio-key'];
    const expected = process.env.MARKETING_STUDIO_KEY;

    if (!expected || expected.length < 8) {
      throw new UnauthorizedException('MARKETING_STUDIO_KEY 환경변수가 설정되지 않았습니다.');
    }
    if (key !== expected) {
      throw new UnauthorizedException('스튜디오 키가 올바르지 않습니다.');
    }
    return true;
  }
}
