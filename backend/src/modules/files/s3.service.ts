import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;

  readonly publicBucket: string;
  readonly privateBucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('AWS_ENDPOINT'); // R2 사용 시 세팅

    this.s3 = new S3Client({
      region: config.get<string>('AWS_REGION', 'ap-northeast-2'),
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });

    this.publicBucket = config.get<string>('AWS_S3_PUBLIC_BUCKET', 'gwanriwang-public');
    this.privateBucket = config.get<string>('AWS_S3_BUCKET', 'gwanriwang-private');
  }

  /** Presigned PUT URL 생성 (클라이언트가 직접 S3에 업로드) */
  async createPresignedPutUrl(
    bucket: string,
    key: string,
    contentType: string,
    fileSizeBytes: number,
    companyId: string,
    userId: string,
    expiresIn = 600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSizeBytes,
      Metadata: {
        'company-id': companyId,
        'uploaded-by': userId,
      },
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /** Presigned GET URL 생성 (비공개 파일 다운로드) */
  async createPresignedGetUrl(
    bucket: string,
    key: string,
    fileName: string,
    expiresIn = 300,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /** HeadObject로 파일 존재 여부 및 실제 크기 확인 */
  async checkFileExists(
    bucket: string,
    key: string,
  ): Promise<{ exists: boolean; size: number }> {
    try {
      const result = await this.s3.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return { exists: true, size: result.ContentLength ?? 0 };
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        return { exists: false, size: 0 };
      }
      throw err;
    }
  }

  /** 단일 파일 삭제 */
  async deleteFile(bucket: string, key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    this.logger.log(`S3 삭제: ${bucket}/${key}`);
  }

  /** 배치 삭제 (최대 1000개) */
  async deleteFiles(files: { bucket: string; key: string }[]): Promise<void> {
    // 버킷별로 그룹핑
    const byBucket = files.reduce<Record<string, string[]>>((acc, f) => {
      (acc[f.bucket] ??= []).push(f.key);
      return acc;
    }, {});

    for (const [bucket, keys] of Object.entries(byBucket)) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map(k => ({ Key: k })) },
        }),
      );
      this.logger.log(`S3 배치 삭제: ${bucket} ${keys.length}개`);
    }
  }
}
