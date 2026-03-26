import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const dbOk = this.dataSource.isInitialized;
    return {
      status: 'ok',
      service: 'admin-backend',
      database: dbOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
