import { SetMetadata } from '@nestjs/common';

export const ALLOW_EXPIRED_KEY = 'allowExpired';

/**
 * 회사 구독이 expired 상태여도 접근을 허용하는 데코레이터.
 * 결제/구독/계정 관리 같이 expired 상태에서도 작동해야 하는 엔드포인트에 사용.
 *
 * @example
 *   @AllowExpired()
 *   @Get('billing')
 *   getBilling() { ... }
 */
export const AllowExpired = () => SetMetadata(ALLOW_EXPIRED_KEY, true);
