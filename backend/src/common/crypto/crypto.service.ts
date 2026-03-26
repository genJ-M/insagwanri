import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM 대칭 암호화 + HMAC-SHA256 서비스
 *
 * 환경변수:
 *   ENCRYPTION_KEY — 64자리 hex 문자열 (32 bytes)
 *   HMAC_SECRET    — 64자리 hex 문자열 (32 bytes)
 *
 * 암호화 포맷: "<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private encKey!: Buffer;
  private hmacKey!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const encHex = this.config.get<string>('ENCRYPTION_KEY', '');
    const hmacHex = this.config.get<string>('HMAC_SECRET', '');

    if (!encHex || encHex.length !== 64) {
      this.logger.warn('ENCRYPTION_KEY 미설정 — 암호화가 비활성화됩니다. 프로덕션에서는 반드시 설정하세요.');
    }
    if (!hmacHex || hmacHex.length !== 64) {
      this.logger.warn('HMAC_SECRET 미설정 — HMAC이 비활성화됩니다. 프로덕션에서는 반드시 설정하세요.');
    }

    // 키 미설정 시 임시 랜덤 키 사용 (재시작마다 달라짐 — 개발 전용)
    this.encKey = encHex && encHex.length === 64
      ? Buffer.from(encHex, 'hex')
      : crypto.randomBytes(32);
    this.hmacKey = hmacHex && hmacHex.length === 64
      ? Buffer.from(hmacHex, 'hex')
      : crypto.randomBytes(32);
  }

  /** AES-256-GCM 암호화 → "iv:authTag:ciphertext" (base64 구분) */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encKey, iv) as crypto.CipherGCM;
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  /** AES-256-GCM 복호화 */
  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted; // 손상된 데이터 — 원본 반환
    const [ivB64, tagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encKey, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    try {
      return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
    } catch {
      return ''; // 복호화 실패 (키 불일치 등)
    }
  }

  /**
   * HMAC-SHA256 — 암호화된 이메일의 검색 인덱스용
   * 동일 입력에 항상 동일 출력 → 인덱스 조회 가능
   */
  hmac(plaintext: string): string {
    return crypto.createHmac('sha256', this.hmacKey).update(plaintext).digest('hex');
  }

  /** 두 HMAC 값 비교 (timing-safe) */
  hmacEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  }
}
