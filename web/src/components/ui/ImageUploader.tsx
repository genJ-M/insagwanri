'use client';
import { useRef, useState } from 'react';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';

interface ImageUploaderProps {
  /** 현재 이미지 URL (없으면 fallback 렌더) */
  currentUrl?: string | null;
  /** 업로드 완료 후 새 URL 전달 */
  onUpload: (url: string) => void;
  /** 'profiles' | 'logo' */
  feature: 'profiles' | 'logo';
  /** 원형 아바타(프로필) vs 직사각형(로고) */
  shape?: 'circle' | 'rect';
  /** fallback 텍스트 (이니셜 등) */
  fallback?: string;
  className?: string;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export default function ImageUploader({
  currentUrl,
  onUpload,
  feature,
  shape = 'circle',
  fallback,
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview ?? currentUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!inputRef.current) return;
    inputRef.current.value = '';        // 같은 파일 재선택 허용
    if (!file) return;

    setError('');

    if (file.size > MAX_SIZE_BYTES) {
      setError('이미지 파일은 10MB 이하만 업로드 가능합니다.');
      return;
    }

    // 즉시 미리보기
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      // 1) Presigned PUT URL 발급
      const { data: urlRes } = await api.post('/files/upload-url', {
        feature,
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      });
      const { fileId, uploadUrl } = urlRes.data ?? urlRes;

      // 2) S3에 직접 PUT (axios 헤더 없이 fetch 사용)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('S3 업로드 실패');

      // 3) 업로드 확정
      const { data: confirmRes } = await api.post('/files/confirm', { fileId });
      const confirmedUrl = confirmRes.data?.url ?? confirmRes.url;

      setPreview(confirmedUrl);
      onUpload(confirmedUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '업로드 중 오류가 발생했습니다.');
      setPreview(null);   // 미리보기 롤백
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  return (
    <div className={clsx('flex flex-col items-start gap-2', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={clsx(
          'relative overflow-hidden group flex-shrink-0',
          shape === 'circle' ? 'h-16 w-16 rounded-full' : 'h-16 w-32 rounded-xl',
          'bg-gray-200 flex items-center justify-center',
          'border-2 border-transparent hover:border-blue-400 transition-colors',
          uploading && 'cursor-not-allowed',
        )}
      >
        {/* 이미지 or fallback */}
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="업로드 이미지"
            className={clsx(
              'w-full h-full object-cover',
              shape === 'circle' ? 'rounded-full' : 'rounded-xl',
            )}
          />
        ) : (
          <span className="text-2xl font-bold text-gray-400 select-none">
            {fallback ?? (shape === 'circle' ? '?' : '로고')}
          </span>
        )}

        {/* hover overlay */}
        {!uploading && (
          <div className={clsx(
            'absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
            shape === 'circle' ? 'rounded-full' : 'rounded-xl',
          )}>
            <Camera className="h-5 w-5 text-white" />
          </div>
        )}

        {/* 업로드 중 오버레이 */}
        {uploading && (
          <div className={clsx(
            'absolute inset-0 bg-black/50 flex items-center justify-center',
            shape === 'circle' ? 'rounded-full' : 'rounded-xl',
          )}>
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-xs text-gray-400">
        {uploading ? '업로드 중...' : 'JPG·PNG·WEBP·GIF · 최대 10MB'}
      </p>

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
