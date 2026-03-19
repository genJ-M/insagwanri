import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TossPaymentResult {
  success: boolean;
  transactionId?: string;
  failureCode?: string;
  failureReason?: string;
  paidAt?: Date;
  rawResponse?: Record<string, any>;
}

export interface TossRefundResult {
  success: boolean;
  transactionId?: string;
  refundedAmount?: number;
  rawResponse?: Record<string, any>;
}

@Injectable()
export class TossPaymentsService {
  private readonly logger = new Logger(TossPaymentsService.name);
  private readonly baseUrl = 'https://api.tosspayments.com/v1';

  constructor(private configService: ConfigService) {}

  private get secretKey(): string {
    return this.configService.get<string>('TOSS_PAYMENTS_SECRET_KEY', '');
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  // ──────────────────────────────────────────────
  // 빌링키로 자동결제 실행
  // ──────────────────────────────────────────────
  async chargeWithBillingKey(params: {
    billingKey: string;
    customerKey: string;
    orderId: string;
    orderName: string;
    amount: number;
    customerEmail?: string;
  }): Promise<TossPaymentResult> {
    try {
      const body = {
        customerKey: params.customerKey,
        amount: params.amount,
        orderId: params.orderId,
        orderName: params.orderName,
        customerEmail: params.customerEmail,
      };

      const response = await fetch(`${this.baseUrl}/billing/${params.billingKey}`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        this.logger.warn(`Toss 결제 실패: ${data.code} — ${data.message}`);
        return {
          success: false,
          failureCode: data.code,
          failureReason: data.message,
          rawResponse: data,
        };
      }

      return {
        success: true,
        transactionId: data.paymentKey,
        paidAt: new Date(data.approvedAt),
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error('Toss 결제 API 오류', error);
      return {
        success: false,
        failureCode: 'NETWORK_ERROR',
        failureReason: '결제 서버 연결 오류',
      };
    }
  }

  // ──────────────────────────────────────────────
  // 환불 처리
  // ──────────────────────────────────────────────
  async refund(params: {
    paymentKey: string;
    cancelReason: string;
    cancelAmount?: number; // undefined = 전액 환불
  }): Promise<TossRefundResult> {
    try {
      const body: any = { cancelReason: params.cancelReason };
      if (params.cancelAmount !== undefined) {
        body.cancelAmount = params.cancelAmount;
      }

      const response = await fetch(`${this.baseUrl}/payments/${params.paymentKey}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new BadRequestException(`환불 실패: ${data.message}`);
      }

      const canceledTx = data.cancels?.[data.cancels.length - 1];
      return {
        success: true,
        transactionId: canceledTx?.transactionKey,
        refundedAmount: canceledTx?.cancelAmount,
        rawResponse: data,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Toss 환불 API 오류', error);
      throw new BadRequestException('환불 서버 연결 오류');
    }
  }
}
