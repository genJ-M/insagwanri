import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AdminRole } from '../../database/entities/admin-user.entity';

// 권한 계층: 상위 역할은 하위 역할의 모든 권한을 포함
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 5,
  [AdminRole.OPERATIONS]: 4,
  [AdminRole.BILLING]: 3,
  [AdminRole.SUPPORT]: 2,
  [AdminRole.READONLY]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    const userLevel = ROLE_HIERARCHY[user.role as AdminRole] ?? 0;
    const hasPermission = requiredRoles.some(
      (role) => userLevel >= ROLE_HIERARCHY[role],
    );

    if (!hasPermission) {
      throw new ForbiddenException('이 작업에 대한 권한이 없습니다.');
    }

    return true;
  }
}
