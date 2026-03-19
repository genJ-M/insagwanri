import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonLogger } from './winston.config';

/**
 * 전역 로거 모듈
 * 모든 NestJS Logger 인스턴스가 Winston으로 라우팅됩니다.
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRoot({ instance: winstonLogger }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
