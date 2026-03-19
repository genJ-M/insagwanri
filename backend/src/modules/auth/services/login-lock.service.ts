import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

const MAX_ATTEMPTS = 5;          // 최대 실패 허용 횟수
const LOCK_TTL_SEC = 15 * 60;   // 잠금 유지 시간: 15분
const ATTEMPT_TTL_SEC = 15 * 60; // 실패 카운터 TTL

@Injectable()
export class LoginLockService implements OnModuleDestroy {
  private readonly logger = new Logger(LoginLockService.name);
  private client: RedisClientType;
  private ready = false;

  constructor(private readonly config: ConfigService) {
    this.client = createClient({
      url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    }) as RedisClientType;

    this.client.on('error', (err) =>
      this.logger.error('Redis 연결 오류 (로그인 잠금 비활성화됨)', err),
    );

    this.client
      .connect()
      .then(() => {
        this.ready = true;
        this.logger.log('Redis 연결 완료 (LoginLockService)');
      })
      .catch((err) =>
        this.logger.warn('Redis 연결 실패 — 로그인 잠금 기능이 비활성화됩니다.', err),
      );
  }

  async onModuleDestroy() {
    if (this.ready) await this.client.quit();
  }

  // ── 키 헬퍼 ────────────────────────────────────────────────────────────────
  private keyAttempts(email: string) {
    return `login:fail:${email.toLowerCase()}`;
  }
  private keyLock(email: string) {
    return `login:lock:${email.toLowerCase()}`;
  }

  // ── 잠금 여부 확인 ─────────────────────────────────────────────────────────
  async isLocked(email: string): Promise<boolean> {
    if (!this.ready) return false;
    try {
      return (await this.client.exists(this.keyLock(email))) === 1;
    } catch {
      return false;
    }
  }

  /**
   * 남은 잠금 시간(초)을 반환합니다.
   * 잠금 상태가 아니면 0 반환.
   */
  async getLockTtl(email: string): Promise<number> {
    if (!this.ready) return 0;
    try {
      const ttl = await this.client.ttl(this.keyLock(email));
      return ttl > 0 ? ttl : 0;
    } catch {
      return 0;
    }
  }

  // ── 실패 기록 ──────────────────────────────────────────────────────────────
  /**
   * 로그인 실패 횟수를 증가시킵니다.
   * @returns 현재 실패 횟수
   */
  async recordFailure(email: string): Promise<number> {
    if (!this.ready) return 0;
    try {
      const key = this.keyAttempts(email);
      const count = await this.client.incr(key);

      // 첫 실패 시 TTL 설정
      if (count === 1) {
        await this.client.expire(key, ATTEMPT_TTL_SEC);
      }

      // 5회 도달 시 잠금
      if (count >= MAX_ATTEMPTS) {
        await this.client.set(this.keyLock(email), '1', { EX: LOCK_TTL_SEC });
        this.logger.warn(`계정 잠금: ${email} (${count}회 실패)`);
      }

      return count;
    } catch {
      return 0;
    }
  }

  // ── 성공 시 초기화 ─────────────────────────────────────────────────────────
  async clearFailures(email: string): Promise<void> {
    if (!this.ready) return;
    try {
      await this.client.del(this.keyAttempts(email));
      await this.client.del(this.keyLock(email));
    } catch {
      // 무시 — 로그인은 정상 처리
    }
  }
}
