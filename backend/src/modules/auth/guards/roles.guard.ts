import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole, AuthenticatedUser } from '../../../common/types/jwt-payload.type';

/**
 * 역할 기반 접근 제어(RBAC) 가드
 * JwtAuthGuard 이후에 실행되어야 합니다.
 * @Roles() 데코레이터로 허용 역할을 지정합니다.
 *
 * 역할 계층:
 *   owner > manager > employee
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(UserRole.OWNER, UserRole.MANAGER)
 * @Get('attendance')
 * getAttendance() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  // 역할 계층 정의: 상위 역할은 하위 역할의 모든 권한 포함
  private readonly roleHierarchy: Record<UserRole, number> = {
    [UserRole.OWNER]: 3,
    [UserRole.MANAGER]: 2,
    [UserRole.EMPLOYEE]: 1,
  };

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // @Roles() 데코레이터가 없으면 인증만 된 사용자 통과
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('사용자 정보를 찾을 수 없습니다.');
    }

    const userLevel = this.roleHierarchy[user.role];

    // 요구 역할 중 하나라도 충족하면 통과
    const hasPermission = requiredRoles.some((requiredRole) => {
      const requiredLevel = this.roleHierarchy[requiredRole];
      return userLevel >= requiredLevel;
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `이 작업은 [${requiredRoles.join(', ')}] 권한이 필요합니다. 현재 권한: ${user.role}`,
      );
    }

    return true;
  }
}
