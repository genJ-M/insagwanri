import { Controller, Get } from '@nestjs/common';
import { SearchService } from './search.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /api/v1/search/index
   * 검색 인덱스 전체 반환 — 프론트에서 클라이언트 사이드 필터링용
   */
  @Get('index')
  async getIndex(@GetUser() currentUser: AuthenticatedUser) {
    return this.searchService.buildIndex(currentUser);
  }
}
