import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { FeatureModulesService } from '../../modules/feature-modules/feature-modules.service';
import { AuthenticatedUser } from '../types/jwt-payload.type';

/**
 * 모듈 접근 제어 가드
 * JwtAuthGuard, RolesGuard 이후에 실행됩니다.
 * @RequireModule('moduleId') 데코레이터가 있는 라우트에만 동작합니다.
 *
 * 비활성 모듈에 접근 시 → 403 + 업그레이드 안내 메시지
 */
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureModulesService: FeatureModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 핸들러 → 클래스 순으로 메타데이터 탐색
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // @RequireModule() 없으면 통과
    if (!requiredModule) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // 인증 전 요청은 JwtAuthGuard에서 처리 — 여기서는 user가 항상 존재
    if (!user?.companyId) return false;

    const isActive = await this.featureModulesService.isModuleActive(
      user.companyId,
      requiredModule,
    );

    if (!isActive) {
      throw new ForbiddenException(
        `'${requiredModule}' 모듈이 현재 플랜에 포함되어 있지 않습니다. 플랜을 업그레이드하거나 설정에서 모듈을 활성화해 주세요.`,
      );
    }

    return true;
  }
}
