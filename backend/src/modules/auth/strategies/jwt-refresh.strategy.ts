import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtRefreshPayload } from '../../../common/types/jwt-payload.type';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,  // Request 객체를 validate()에 전달
    });
  }

  /**
   * Refresh Token 검증 후 호출됩니다.
   * 원본 refresh_token을 payload와 함께 반환하여
   * AuthService에서 DB에 저장된 해시와 비교합니다.
   */
  async validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken = req.body?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh Token이 없습니다.');
    }

    return {
      ...payload,
      refreshToken, // AuthService에서 해시 비교에 사용
    };
  }
}
