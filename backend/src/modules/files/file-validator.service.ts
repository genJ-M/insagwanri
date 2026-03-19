import { Injectable, BadRequestException } from '@nestjs/common';
import { FileFeature } from '../../database/entities/file.entity';

// ── 허용 MIME 카테고리 ────────────────────────────────────────────────────────
const ALLOWED_MIME: Record<string, { ext: string[]; maxBytes: number }> = {
  'image/jpeg':       { ext: ['jpg', 'jpeg'], maxBytes: 10 * 1024 * 1024 },
  'image/png':        { ext: ['png'],          maxBytes: 10 * 1024 * 1024 },
  'image/webp':       { ext: ['webp'],         maxBytes: 10 * 1024 * 1024 },
  'image/gif':        { ext: ['gif'],          maxBytes: 10 * 1024 * 1024 },
  'application/pdf':  { ext: ['pdf'],          maxBytes: 50 * 1024 * 1024 },
  'application/vnd.ms-excel': { ext: ['xls'], maxBytes: 50 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: ['xlsx'], maxBytes: 50 * 1024 * 1024 },
  'application/msword': { ext: ['doc'],        maxBytes: 50 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: ['docx'], maxBytes: 50 * 1024 * 1024 },
  'application/vnd.ms-powerpoint': { ext: ['ppt'], maxBytes: 50 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: ['pptx'], maxBytes: 50 * 1024 * 1024 },
  'application/zip':               { ext: ['zip'], maxBytes: 100 * 1024 * 1024 },
  'application/x-zip-compressed':  { ext: ['zip'], maxBytes: 100 * 1024 * 1024 },
  'text/plain': { ext: ['txt'],    maxBytes: 10 * 1024 * 1024 },
  'text/csv':   { ext: ['csv'],    maxBytes: 10 * 1024 * 1024 },
};

// ── 기능별 허용 MIME ──────────────────────────────────────────────────────────
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_TYPES = ['application/pdf'];
const OFFICE_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const ZIP_TYPES = ['application/zip', 'application/x-zip-compressed'];
const TEXT_TYPES = ['text/plain', 'text/csv'];

const FEATURE_ALLOWED: Record<FileFeature, string[]> = {
  profiles: IMAGE_TYPES,
  logo:     IMAGE_TYPES,
  tasks:    [...IMAGE_TYPES, ...DOC_TYPES, ...OFFICE_TYPES, ...ZIP_TYPES, ...TEXT_TYPES],
  messages: [...IMAGE_TYPES, ...DOC_TYPES, ...OFFICE_TYPES, ...ZIP_TYPES],
  reports:  [...IMAGE_TYPES, ...DOC_TYPES, ...OFFICE_TYPES, ...TEXT_TYPES],
};

// ── 플랜별 단일 파일 최대 크기 ────────────────────────────────────────────────
export const PLAN_MAX_FILE_BYTES: Record<string, number> = {
  free:       10 * 1024 * 1024,
  basic:      50 * 1024 * 1024,
  pro:       100 * 1024 * 1024,
  enterprise: 100 * 1024 * 1024,
};

@Injectable()
export class FileValidatorService {
  /**
   * MIME 화이트리스트 + 기능별 허용 여부 + 파일 크기 검증
   * 통과하면 확장자를 반환한다.
   */
  validate(
    feature: FileFeature,
    contentType: string,
    fileSizeBytes: number,
  ): string {
    const allowed = ALLOWED_MIME[contentType];
    if (!allowed) {
      throw new BadRequestException(`허용되지 않는 파일 형식: ${contentType}`);
    }

    if (!FEATURE_ALLOWED[feature].includes(contentType)) {
      throw new BadRequestException(
        `'${feature}' 기능에서는 ${contentType} 파일을 업로드할 수 없습니다.`,
      );
    }

    if (fileSizeBytes > allowed.maxBytes) {
      const maxMb = allowed.maxBytes / 1024 / 1024;
      throw new BadRequestException(
        `파일 크기가 초과되었습니다. 최대 ${maxMb}MB`,
      );
    }

    return allowed.ext[0]; // 대표 확장자 반환
  }
}
