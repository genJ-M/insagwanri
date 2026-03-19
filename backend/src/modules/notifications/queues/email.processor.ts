import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

export interface EmailJob {
  templateName: string;
  to: string;
  subject: string;
  html: string;
  notificationId?: string;
}

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.resend = new Resend(configService.get<string>('RESEND_API_KEY'));
    this.from = configService.get<string>('EMAIL_FROM', 'noreply@gwanriwang.com');
  }

  async process(job: Job<EmailJob>): Promise<void> {
    const { to, subject, html, notificationId } = job.data;

    try {
      await this.resend.emails.send({
        from: `관리왕 <${this.from}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`이메일 발송 완료: ${to} (notificationId: ${notificationId ?? 'N/A'})`);
    } catch (error) {
      this.logger.error(`이메일 발송 실패: ${to}`, error);
      throw error; // BullMQ 재시도 트리거
    }
  }
}
