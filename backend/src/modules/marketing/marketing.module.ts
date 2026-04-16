import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { MarketingPublicController, MarketingStudioController } from './marketing.controller';

@Module({
  controllers: [MarketingPublicController, MarketingStudioController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
