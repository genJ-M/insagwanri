import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * 다른 모듈(CollaborationService, TasksService 등)에서 소켓 이벤트를 발행할 때 사용.
 * DB 저장 완료 후 이 서비스를 통해 이벤트 emit.
 */
@Injectable()
export class SocketService {
  private io: Server | null = null;

  /** SocketGateway에서 서버 인스턴스 주입 */
  setServer(io: Server) {
    this.io = io;
  }

  /** 채널 룸 전체에 이벤트 발행 */
  emitToChannel(channelId: string, event: string, data: unknown) {
    this.io?.to(`channel:${channelId}`).emit(event, data);
  }

  /** 특정 사용자 룸에 이벤트 발행 */
  emitToUser(userId: string, event: string, data: unknown) {
    this.io?.to(`user:${userId}`).emit(event, data);
  }

  /** 회사 전체에 이벤트 발행 (향후 확장용) */
  emitToCompany(companyId: string, event: string, data: unknown) {
    this.io?.to(`company:${companyId}`).emit(event, data);
  }
}
