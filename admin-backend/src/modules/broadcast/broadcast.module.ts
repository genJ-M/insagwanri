import { Module } from '@nestjs/common';
import { BroadcastController } from './broadcast.controller';

@Module({ controllers: [BroadcastController] })
export class BroadcastModule {}
