import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MODULE_KEY = 'requireModule';

/**
 * 해당 컨트롤러·핸들러에 접근하려면 지정 모듈이 활성화되어 있어야 합니다.
 * ModuleAccessGuard와 함께 동작합니다.
 *
 * @example 컨트롤러 전체 보호
 * @RequireModule('salary')
 * @Controller('salary')
 * export class SalaryController { ... }
 *
 * @example 특정 엔드포인트만 보호
 * @Get('report')
 * @RequireModule('ai')
 * getReport() { ... }
 */
export const RequireModule = (moduleId: string) =>
  SetMetadata(REQUIRE_MODULE_KEY, moduleId);
