import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/types/jwt-payload.type';

/**
 * 컨트롤러 메서드 파라미터에서 인증된 사용자 정보를 주입합니다.
 *
 * @example
 * @Get('me')
 * getMe(@GetUser() user: AuthenticatedUser) { ... }
 *
 * @example 특정 필드만 추출
 * @Get('me')
 * getMe(@GetUser('id') userId: string) { ... }
 */
export const GetUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) return null;
    return field ? user[field] : user;
  },
);
