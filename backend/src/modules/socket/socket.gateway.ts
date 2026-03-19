import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocketService } from './socket.service';
import { ChannelMember } from '../../database/entities/channel-member.entity';

@WebSocketGateway({
  cors: {
    origin: '*',       // 프로덕션에서는 FRONTEND_URL 환경변수로 제한
    credentials: true,
  },
  transports: ['websocket'],
})
@Injectable()
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly socketService: SocketService,
    @InjectRepository(ChannelMember)
    private readonly channelMemberRepo: Repository<ChannelMember>,
  ) {}

  // ─────────────────────────────────────────
  // 초기화 — SocketService에 서버 인스턴스 주입
  // ─────────────────────────────────────────
  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.logger.log('Socket.io Gateway initialized');

    // JWT 인증 미들웨어
    server.use(async (socket, next) => {
      const token =
        (socket.handshake.auth as any).token ??
        socket.handshake.query.token;

      if (!token) {
        return next(new Error('UNAUTHORIZED'));
      }

      try {
        const payload = this.jwtService.verify(token as string, {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        });
        socket.data.userId    = payload.sub;
        socket.data.companyId = payload.companyId;
        socket.data.role      = payload.role;
        next();
      } catch {
        next(new Error('TOKEN_EXPIRED'));
      }
    });
  }

  // ─────────────────────────────────────────
  // 연결
  // ─────────────────────────────────────────
  handleConnection(socket: Socket) {
    const { userId, companyId } = socket.data;
    if (!userId) {
      socket.disconnect();
      return;
    }

    // 개인 룸 자동 가입
    socket.join(`user:${userId}`);
    this.logger.log(`Connected: ${userId}`);

    socket.emit('connected', { userId, companyId });
  }

  // ─────────────────────────────────────────
  // 해제
  // ─────────────────────────────────────────
  handleDisconnect(socket: Socket) {
    this.logger.log(`Disconnected: ${socket.data.userId ?? socket.id}`);
  }

  // ─────────────────────────────────────────
  // 채널 입장
  // ─────────────────────────────────────────
  @SubscribeMessage('channel:join')
  async handleChannelJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    const { channelId } = data;
    const { userId, companyId } = socket.data;

    // 채널 멤버 검증
    const member = await this.channelMemberRepo.findOne({
      where: { channelId, userId },
      relations: ['channel'],
    });

    if (!member || member.channel?.companyId !== companyId) {
      socket.emit('error', { code: 'NOT_MEMBER', message: '채널 멤버가 아닙니다.' });
      return { success: false, error: 'NOT_MEMBER' };
    }

    socket.join(`channel:${channelId}`);
    return { success: true };
  }

  // ─────────────────────────────────────────
  // 채널 퇴장
  // ─────────────────────────────────────────
  @SubscribeMessage('channel:leave')
  handleChannelLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    socket.leave(`channel:${data.channelId}`);
    return { success: true };
  }

  // ─────────────────────────────────────────
  // 읽음 처리
  // ─────────────────────────────────────────
  @SubscribeMessage('channel:read')
  async handleChannelRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { channelId: string; lastReadAt: string },
  ) {
    const { channelId, lastReadAt } = data;
    const { userId } = socket.data;

    await this.channelMemberRepo.update(
      { channelId, userId },
      { lastReadAt: new Date(lastReadAt) },
    );

    // 같은 채널 룸의 다른 사용자에게 읽음 상태 브로드캐스트
    socket.to(`channel:${channelId}`).emit('channel:read_updated', {
      channelId,
      userId,
      lastReadAt,
    });

    return { success: true };
  }

  // ─────────────────────────────────────────
  // 모든 알림 읽음 처리 (notifications 모듈 구현 후 연결)
  // ─────────────────────────────────────────
  @SubscribeMessage('notification:read_all')
  async handleNotificationReadAll(@ConnectedSocket() socket: Socket) {
    // TODO: notifications 엔티티 구현 후 is_read = true 처리
    return { success: true };
  }
}
