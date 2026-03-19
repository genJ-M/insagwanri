import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * 소켓 인스턴스 반환 (싱글톤).
 * 이미 연결된 경우 기존 인스턴스 재사용.
 */
export function getSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  // 토큰 만료 시 갱신 후 재연결
  socket.on('error', ({ code }: { code: string }) => {
    if (code === 'TOKEN_EXPIRED') {
      const newToken = typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null;
      if (newToken && socket) {
        (socket.auth as any).token = newToken;
        socket.connect();
      }
    }
  });

  return socket;
}

/**
 * 소켓 연결 해제 (로그아웃 시 호출).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
