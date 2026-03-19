import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../common/types/jwt-payload.type';

export const ROLES_KEY = 'roles';

/**
 * 엔드포인트에 접근 가능한 역할을 지정합니다.
 * RolesGuard와 함께 사용됩니다.
 *
 * @example 단일 역할
 * @Roles(UserRole.OWNER)
 *
 * @example 복수 역할
 * @Roles(UserRole.OWNER, UserRole.MANAGER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * 인증만 필요하고 역할 제한이 없는 엔드포인트에 사용합니다.
 */
export const Public = () => SetMetadata('isPublic', true);
