import * as winston from 'winston';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// ── 로컬 개발용 포맷 (컬러 + 가독성) ─────────────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, context, stack, ...meta }) => {
    const ctx = context ? ` [${context}]` : '';
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}${ctx}: ${message}${extra}${stack ? `\n${stack}` : ''}`;
  }),
);

// ── 프로덕션용 포맷 (JSON, CloudWatch 수집 대응) ──────────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

// ── Transports ────────────────────────────────────────────────────────────────

function buildTransports(): winston.transport[] {
  if (isTest) return [];           // 테스트 시 로그 출력 없음

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: isProduction ? prodFormat : devFormat,
    }),
  ];

  // 프로덕션에서만 CloudWatch 전송
  if (isProduction && process.env.AWS_CLOUDWATCH_GROUP) {
    const WinstonCloudWatch = require('winston-cloudwatch');
    transports.push(
      new WinstonCloudWatch({
        logGroupName:  process.env.AWS_CLOUDWATCH_GROUP,   // /gwanri/backend/production
        logStreamName: `${process.env.HOSTNAME ?? 'instance'}-${new Date().toISOString().slice(0, 10)}`,
        awsRegion:     process.env.AWS_REGION ?? 'ap-northeast-2',
        jsonMessage:   true,
        retentionInDays: 30,
        // ECS Task Role로 자동 인증 (명시적 키 불필요)
      }),
    );
  }

  return transports;
}

// ── Winston Logger 인스턴스 ───────────────────────────────────────────────────

export const winstonLogger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  defaultMeta: {
    service: 'gwanri-backend',
    env: process.env.NODE_ENV,
  },
  transports: buildTransports(),
  // 미처리 예외/Promise 거부도 캡처
  exceptionHandlers: isTest ? [] : [
    new winston.transports.Console({ format: isProduction ? prodFormat : devFormat }),
  ],
  rejectionHandlers: isTest ? [] : [
    new winston.transports.Console({ format: isProduction ? prodFormat : devFormat }),
  ],
});
