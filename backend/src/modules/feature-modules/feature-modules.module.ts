import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureModulesController } from './feature-modules.controller';
import { FeatureModulesService } from './feature-modules.service';
import { CompanyModule } from './entities/company-module.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyModule])],
  controllers: [FeatureModulesController],
  providers: [FeatureModulesService],
  exports: [FeatureModulesService],  // Guard·SubscriptionsService 등에서 주입 가능
})
export class FeatureModulesModule {}
