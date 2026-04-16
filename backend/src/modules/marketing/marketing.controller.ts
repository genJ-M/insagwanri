import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { StudioKeyGuard } from './studio-key.guard';
import {
  UpsertBlockDto, BulkUpsertBlocksDto,
  CreateBannerDto, UpdateBannerDto,
  CreatePopupDto, UpdatePopupDto,
} from './dto/marketing.dto';

// ── Public endpoints (no auth, for landing page SSR) ─────────────

@Controller('marketing/public')
export class MarketingPublicController {
  constructor(private readonly svc: MarketingService) {}

  /** 모든 텍스트 블록 (section → key → value 맵) */
  @Get('blocks')
  getAllBlocks() { return this.svc.getAllBlocks(); }

  /** 섹션 단위 조회 */
  @Get('blocks/:section')
  getSection(@Param('section') section: string) { return this.svc.getSection(section); }

  /** 현재 활성 배너 (없으면 null) */
  @Get('banner')
  getActiveBanner() { return this.svc.getActiveBanner(); }

  /** 현재 활성 팝업 목록 */
  @Get('popups')
  getActivePopups() { return this.svc.getActivePopups(); }
}

// ── Studio endpoints (x-studio-key header required) ───────────────

@Controller('marketing/studio')
@UseGuards(StudioKeyGuard)
export class MarketingStudioController {
  constructor(private readonly svc: MarketingService) {}

  // Blocks
  @Get('blocks')
  getAllBlocks() { return this.svc.getAllBlocks(); }

  @Post('blocks')
  upsertBlock(@Body() dto: UpsertBlockDto) { return this.svc.upsertBlock(dto); }

  @Post('blocks/bulk')
  bulkUpsert(@Body() dto: BulkUpsertBlocksDto) { return this.svc.bulkUpsertBlocks(dto.blocks); }

  // Banners
  @Get('banners')
  listBanners() { return this.svc.listBanners(); }

  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto) { return this.svc.createBanner(dto); }

  @Patch('banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) { return this.svc.updateBanner(id, dto); }

  @Delete('banners/:id')
  deleteBanner(@Param('id') id: string) { return this.svc.deleteBanner(id); }

  // Popups
  @Get('popups')
  listPopups() { return this.svc.listPopups(); }

  @Post('popups')
  createPopup(@Body() dto: CreatePopupDto) { return this.svc.createPopup(dto); }

  @Patch('popups/:id')
  updatePopup(@Param('id') id: string, @Body() dto: UpdatePopupDto) { return this.svc.updatePopup(id, dto); }

  @Delete('popups/:id')
  deletePopup(@Param('id') id: string) { return this.svc.deletePopup(id); }
}
