import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Feedback, FeedbackType } from '../../database/entities/feedback.entity';
import { EmailJob } from '../notifications/queues/email.processor';

export class CreateFeedbackDto {
  type: FeedbackType;
  content?: string;
  contextJson?: Record<string, any>;
  screenshotUrl?: string;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectQueue('email-queue')
    private readonly emailQueue: Queue<EmailJob>,
    private readonly config: ConfigService,
  ) {}

  async create(
    userId: string | null,
    companyId: string | null,
    dto: CreateFeedbackDto,
  ): Promise<Feedback> {
    const feedback = this.feedbackRepo.create({
      type: dto.type,
      content: dto.content ?? null,
      contextJson: dto.contextJson ?? null,
      screenshotUrl: dto.screenshotUrl ?? null,
      userId,
      companyId,
    });
    const saved = await this.feedbackRepo.save(feedback);

    // 개발자 이메일 알림 (비동기, 실패해도 응답 막지 않음)
    this.notifyDeveloper(saved).catch((err) =>
      this.logger.error('개발자 이메일 알림 실패', err),
    );

    return saved;
  }

  private async notifyDeveloper(fb: Feedback): Promise<void> {
    const devEmail = this.config.get<string>('DEV_FEEDBACK_EMAIL', 'dev@gwanriwang.com');
    const typeLabel: Record<FeedbackType, string> = {
      [FeedbackType.BUG]: '버그/오류 신고',
      [FeedbackType.SUGGESTION]: '기능 제안',
      [FeedbackType.CONTACT]: '직접 문의',
    };
    const label = typeLabel[fb.type] ?? fb.type;

    const contextHtml = fb.contextJson
      ? `<pre style="background:#f3f4f6;padding:12px;border-radius:4px;font-size:12px;overflow:auto;">${
          JSON.stringify(fb.contextJson, null, 2)
        }</pre>`
      : '';

    const screenshotHtml = fb.screenshotUrl
      ? `<p><strong>스크린샷:</strong><br/>
         <a href="${fb.screenshotUrl}" style="color:#2563EB;">이미지 열기</a></p>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>피드백 수신</title></head>
<body style="font-family:sans-serif;background:#f5f5f5;margin:0;padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" align="center"
         style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <tr>
      <td style="background:#2563EB;padding:20px 32px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">관리왕 — 새 피드백 수신</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;">
        <table width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:80px;">유형</td>
            <td style="padding:6px 0;font-weight:600;">${label}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">회사 ID</td>
            <td style="padding:6px 0;">${fb.companyId ?? '미확인'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">사용자 ID</td>
            <td style="padding:6px 0;">${fb.userId ?? '미확인'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">내용</td>
            <td style="padding:6px 0;">${fb.content ?? '(내용 없음)'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">수신 시각</td>
            <td style="padding:6px 0;">${fb.createdAt.toISOString()}</td>
          </tr>
        </table>
        ${screenshotHtml}
        <p style="margin-top:16px;"><strong>컨텍스트 정보:</strong></p>
        ${contextHtml}
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:12px 32px;font-size:12px;color:#6b7280;">
        feedback ID: ${fb.id}
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.emailQueue.add('send-email', {
      templateName: 'developer-feedback',
      to: devEmail,
      subject: `[관리왕 피드백] ${label} — ${fb.id.slice(0, 8)}`,
      html,
    });
  }
}
