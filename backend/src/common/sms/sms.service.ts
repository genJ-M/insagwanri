import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SmsService — 한국 SMS 발송 스텁
 *
 * 프로덕션 연동 가이드:
 *   - Naver Cloud SENS: https://guide.ncloud-docs.com/docs/sens-sens-1-1
 *   - Coolsms:          https://developers.coolsms.co.kr/
 *   - Aligo:            https://smartsms.aligo.in/admin/api/spec.html
 *
 * 환경변수:
 *   SMS_PROVIDER  = 'coolsms' | 'sens' | 'aligo' (기본: log-only)
 *   SMS_API_KEY   = 발급받은 API Key
 *   SMS_API_SECRET= 발급받은 API Secret
 *   SMS_FROM      = 발신번호 (예: 01012345678)
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;
  private readonly fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    this.provider   = configService.get<string>('SMS_PROVIDER', 'log');
    this.fromNumber = configService.get<string>('SMS_FROM', '');
  }

  async send(to: string, message: string): Promise<void> {
    const normalizedTo = this.normalizePhone(to);

    if (this.provider === 'log' || !this.fromNumber) {
      // 개발 환경: 콘솔에만 출력
      this.logger.log(`[SMS-DEV] → ${normalizedTo}\n${message}`);
      return;
    }

    try {
      if (this.provider === 'coolsms') {
        await this.sendViaCoolsms(normalizedTo, message);
      } else if (this.provider === 'sens') {
        await this.sendViaSens(normalizedTo, message);
      } else {
        this.logger.warn(`[SMS] 알 수 없는 provider: ${this.provider}. 로그 출력으로 대체.`);
        this.logger.log(`[SMS-FALLBACK] → ${normalizedTo}\n${message}`);
      }
    } catch (err) {
      this.logger.error(`[SMS] 발송 실패 → ${normalizedTo}`, err);
      // fire-and-forget: 실패해도 예외 전파하지 않음
    }
  }

  /** OTP 발송 전용 헬퍼 */
  async sendOtp(to: string, code: string): Promise<void> {
    const message = `[관리왕] 인증번호: ${code}\n5분 이내에 입력해주세요.`;
    await this.send(to, message);
  }

  /** 초대 SMS 발송 헬퍼 */
  async sendInvite(to: string, companyName: string, inviteUrl: string): Promise<void> {
    const message = `[관리왕] ${companyName}에서 초대했습니다.\n아래 링크로 가입하세요 (48시간 유효):\n${inviteUrl}`;
    await this.send(to, message);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private normalizePhone(phone: string): string {
    // 010-1234-5678 → 01012345678, +82 → 0 변환
    return phone.replace(/\D/g, '').replace(/^82/, '0');
  }

  private async sendViaCoolsms(to: string, message: string): Promise<void> {
    const apiKey    = this.configService.get<string>('SMS_API_KEY', '');
    const apiSecret = this.configService.get<string>('SMS_API_SECRET', '');

    // Coolsms Node SDK (npm install coolsms-node-sdk)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    // @ts-ignore
    const { default: coolsms } = await import('coolsms-node-sdk').catch(() => {
      throw new Error('coolsms-node-sdk가 설치되지 않았습니다. npm install coolsms-node-sdk');
    });
    const messageService = new coolsms(apiKey, apiSecret);
    await messageService.sendOne({
      to,
      from: this.fromNumber,
      text: message,
      type: 'SMS',
      autoTypeDetect: false,
    });
  }

  private async sendViaSens(to: string, message: string): Promise<void> {
    // Naver Cloud SENS — REST API 직접 호출
    const apiKey      = this.configService.get<string>('SMS_API_KEY', '');
    const apiSecret   = this.configService.get<string>('SMS_API_SECRET', '');
    const serviceId   = this.configService.get<string>('SENS_SERVICE_ID', '');
    const timestamp   = Date.now().toString();
    const method      = 'POST';
    const url         = `/sms/v2/services/${serviceId}/messages`;
    const signature   = this.makeSensSignature(method, url, timestamp, apiKey, apiSecret);

    const response = await fetch(
      `https://sens.apigw.ntruss.com${url}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': apiKey,
          'x-ncp-apigw-signature-v2': signature,
        },
        body: JSON.stringify({
          type: 'SMS',
          from: this.fromNumber,
          messages: [{ to, content: message }],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SENS 오류 ${response.status}: ${body}`);
    }
  }

  private makeSensSignature(
    method: string, url: string, timestamp: string,
    accessKey: string, secretKey: string,
  ): string {
    const crypto = require('crypto');
    const message = `${method} ${url}\n${timestamp}\n${accessKey}`;
    return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  }
}
