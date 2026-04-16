import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailJob } from './queues/email.processor';

/**
 * 이메일 발송 유틸리티 서비스.
 * BullMQ email-queue에 Job을 추가하는 단순 래퍼.
 * 다른 모듈(auth, users 등)에서 주입해서 사용.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue('email-queue')
    private readonly emailQueue: Queue<EmailJob>,
  ) {}

  async sendEmailVerification(opts: {
    to: string;
    name: string;
    verifyUrl: string;
    expiresAt: string;
  }) {
    const html = this.buildEmailVerifyHtml(opts);
    await this.emailQueue.add('send-email', {
      templateName: 'auth-email-verify',
      to: opts.to,
      subject: '[관리왕] 이메일 인증을 완료해 주세요',
      html,
    });
    this.logger.log(`이메일 인증 발송: ${opts.to}`);
  }

  async sendInviteEmail(opts: {
    to: string;
    inviterName: string;
    companyName: string;
    inviteUrl: string;
    expiresAt: string;
  }) {
    const html = this.buildInviteHtml(opts);
    await this.emailQueue.add('send-email', {
      templateName: 'user-invite',
      to: opts.to,
      subject: `[관리왕] ${opts.companyName}에서 초대장이 도착했습니다`,
      html,
    });
    this.logger.log(`초대 이메일 발송: ${opts.to}`);
  }

  async sendRaw(opts: { to: string; subject: string; html: string }) {
    await this.emailQueue.add('send-email', {
      templateName: 'raw',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  }

  async sendPasswordReset(opts: {
    to: string;
    name: string;
    resetUrl: string;
  }) {
    const html = this.buildPasswordResetHtml(opts);
    await this.emailQueue.add('send-email', {
      templateName: 'auth-password-reset',
      to: opts.to,
      subject: '[관리왕] 비밀번호 재설정 안내',
      html,
    });
  }

  // ─────────────────────────────────────────
  // HTML 템플릿 빌더 (간단한 인라인 스타일 사용)
  // ─────────────────────────────────────────
  private layout(title: string, content: string): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 0;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <tr>
          <td style="background:#2563EB;padding:24px 32px;">
            <h1 style="color:#fff;margin:0;font-size:20px;">관리왕</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#6b7280;">
            ⓒ ${new Date().getFullYear()} 관리왕. 문의: support@gwanriwang.com
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildEmailVerifyHtml(opts: {
    name: string;
    verifyUrl: string;
    expiresAt: string;
  }): string {
    const content = `
      <p style="font-size:16px;color:#111827;">안녕하세요, <strong>${opts.name}</strong>님!</p>
      <p style="color:#374151;">관리왕 가입을 환영합니다. 아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.</p>
      <p style="margin:28px 0;">
        <a href="${opts.verifyUrl}"
           style="background:#2563EB;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
          이메일 인증하기
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">만료 시각: ${opts.expiresAt}</p>
      <p style="color:#6b7280;font-size:13px;">이 링크는 24시간 후 만료됩니다. 본인이 요청하지 않은 경우 무시해 주세요.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="color:#9ca3af;font-size:12px;">
        📌 <strong>보안 안내:</strong> 계정 1개는 1개 기기에서만 동시 사용이 가능합니다.
        다른 기기에서 로그인하면 기존 기기의 세션이 자동으로 종료됩니다.
      </p>
      <p style="color:#9ca3af;font-size:12px;">
        ⚠️ 이 메일이 스팸함에 들어갔다면, 받은 편지함으로 이동하거나 발신 주소를 연락처에 추가해 주세요.
      </p>
    `;
    return this.layout('이메일 인증', content);
  }

  private buildInviteHtml(opts: {
    inviterName: string;
    companyName: string;
    inviteUrl: string;
    expiresAt: string;
  }): string {
    const content = `
      <p style="font-size:16px;color:#111827;">
        <strong>${opts.inviterName}</strong>님이 <strong>${opts.companyName}</strong>에 초대했습니다.
      </p>
      <p style="color:#374151;">아래 버튼을 클릭하여 48시간 내에 초대를 수락해 주세요.</p>
      <p style="margin:28px 0;">
        <a href="${opts.inviteUrl}"
           style="background:#2563EB;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
          초대 수락하기
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">만료 시각: ${opts.expiresAt}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="color:#9ca3af;font-size:12px;">
        📌 <strong>보안 안내:</strong> 계정 1개는 1개 기기에서만 동시 사용이 가능합니다.
        가입 후 다른 기기에서 로그인하면 이전 기기의 세션이 자동으로 종료됩니다.
      </p>
      <p style="color:#9ca3af;font-size:12px;">
        ⚠️ 이 메일이 스팸함에 들어갔다면, 받은 편지함으로 이동하거나 발신 주소(noreply@gwanriwang.com)를 주소록에 추가해 주세요.
      </p>
    `;
    return this.layout('초대장 도착', content);
  }

  private buildPasswordResetHtml(opts: {
    name: string;
    resetUrl: string;
  }): string {
    const content = `
      <p style="font-size:16px;color:#111827;">안녕하세요, <strong>${opts.name}</strong>님!</p>
      <p style="color:#374151;">비밀번호 재설정 요청을 받았습니다. 아래 버튼을 클릭해 주세요.</p>
      <p style="margin:28px 0;">
        <a href="${opts.resetUrl}"
           style="background:#2563EB;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
          비밀번호 재설정
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">본인이 요청하지 않은 경우 이 이메일을 무시해 주세요.</p>
    `;
    return this.layout('비밀번호 재설정', content);
  }
}
