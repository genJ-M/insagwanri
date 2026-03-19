import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';
import { SocketModule } from '../socket/socket.module';
import { Channel } from '../../database/entities/channel.entity';
import { ChannelMember } from '../../database/entities/channel-member.entity';
import { Message } from '../../database/entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, ChannelMember, Message]),
    SocketModule,
  ],
  controllers: [CollaborationController],
  providers: [CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
