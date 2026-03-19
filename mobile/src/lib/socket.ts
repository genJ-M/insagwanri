import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1')
  .replace('/api/v1', '');

let socket: Socket | null = null;
let connectingPromise: Promise<Socket> | null = null;

export async function getSocket(): Promise<Socket> {
  // 이미 연결된 소켓이 있으면 재사용
  if (socket?.connected) return socket;

  // 진행 중인 연결 요청이 있으면 그 결과를 공유 (중복 연결 방지)
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    // 이전에 연결 실패한 소켓 정리
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    const token = await SecureStore.getItemAsync('accessToken');

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    return socket;
  })().finally(() => {
    connectingPromise = null;
  });

  return connectingPromise;
}

export function disconnectSocket() {
  connectingPromise = null;
  socket?.disconnect();
  socket = null;
}
