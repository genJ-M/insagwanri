import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload, AuthenticatedUser } from '../../../common/types/jwt-payload.type';
import { User, UserStatus } from '../../../database/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      // Authorization: Bearer {token} 헤더에서 토큰 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * JWT 검증 성공 후 호출됩니다.
   * 반환값이 request.user에 주입됩니다.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userRepository.findOne({
      where: {
        id: payload.sub,
        companyId: payload.companyId,
      },
      select: [
        'id', 'companyId', 'role', 'email', 'name',
        'department', 'managedDepartments', 'permissions',
        'status', 'deletedAt', 'currentSessionId',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('탈퇴한 사용자입니다.');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }

    // 단일 기기 세션 강제: JWT의 sessionId가 DB의 currentSessionId와 다르면 다른 기기에서 로그인된 것
    if (payload.sessionId && user.currentSessionId && payload.sessionId !== user.currentSessionId) {
      throw new UnauthorizedException({
        code: 'SESSION_REPLACED',
        message: '다른 기기에서 로그인되어 현재 세션이 종료되었습니다.',
      });
    }

    return {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name,
      department: user.department,
      managedDepartments: user.managedDepartments,
      permissions: user.permissions,
    };
  }
}
