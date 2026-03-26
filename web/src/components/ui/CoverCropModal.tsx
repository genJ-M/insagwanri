'use client';
import { useState, useRef, useCallback } from 'react';
import { X, Smartphone, Move } from 'lucide-react';
import Button from './Button';

// 모바일 커버 비율: 390 × 260 = 9:6 ≈ 3:2
const MOBILE_ASPECT = 390 / 260;
// 크롭 프레임 표시 너비 (px, 프리뷰 내)
const FRAME_DISPLAY_W = 195; // 프리뷰의 절반 너비
const FRAME_DISPLAY_H = FRAME_DISPLAY_W / MOBILE_ASPECT;

interface CropResult {
  x: number;      // 원본 이미지 기준 (0~1 비율)
  y: number;
  width: number;
  height: number;
}

interface Props {
  webImageUrl: string;
  initialCrop?: CropResult | null;
  onConfirm: (crop: CropResult, mobileUrl: string) => void;
  onClose: () => void;
}

export default function CoverCropModal({ webImageUrl, initialCrop, onConfirm, onClose }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 }); // 렌더링된 img 크기
  const [framePos, setFramePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; fx: number; fy: number } | null>(null);

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    setImgSize({ w: rect.width, h: rect.height });
    // 초기 crop 위치
    if (initialCrop) {
      setFramePos({
        x: initialCrop.x * rect.width,
        y: initialCrop.y * rect.height,
      });
    } else {
      setFramePos({ x: (rect.width - FRAME_DISPLAY_W) / 2, y: (rect.height - FRAME_DISPLAY_H) / 2 });
    }
  }, [initialCrop]);

  const clampPos = (x: number, y: number, w: number, h: number) => ({
    x: Math.max(0, Math.min(x, w - FRAME_DISPLAY_W)),
    y: Math.max(0, Math.min(y, h - FRAME_DISPLAY_H)),
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: framePos.x, fy: framePos.y };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const clamped = clampPos(
      dragStart.current.fx + dx,
      dragStart.current.fy + dy,
      imgSize.w, imgSize.h,
    );
    setFramePos(clamped);
  }, [dragging, imgSize]);

  const handleMouseUp = () => setDragging(false);

  const handleConfirm = () => {
    if (!imgSize.w) return;
    const crop: CropResult = {
      x: framePos.x / imgSize.w,
      y: framePos.y / imgSize.h,
      width: FRAME_DISPLAY_W / imgSize.w,
      height: FRAME_DISPLAY_H / imgSize.h,
    };
    // 모바일 URL은 웹 URL과 동일 (서버에서 crop 좌표로 렌더링)
    onConfirm(crop, webImageUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary-500" />
            <h3 className="text-sm font-semibold text-text-primary">모바일 커버 영역 선택</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 안내 문구 */}
        <p className="text-xs text-text-secondary px-5 pt-3">
          파란 프레임을 드래그하여 모바일 앱에 표시될 영역을 선택하세요 (3:2 비율).
        </p>

        {/* 크롭 영역 */}
        <div
          ref={previewRef}
          className="relative mx-5 my-4 overflow-hidden rounded-xl select-none"
          style={{ cursor: dragging ? 'grabbing' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* 배경 이미지 */}
          <img
            src={webImageUrl}
            alt="커버 이미지"
            className="w-full object-cover rounded-xl"
            style={{ maxHeight: 320, objectFit: 'cover' }}
            onLoad={onImgLoad}
            draggable={false}
          />

          {/* 어두운 오버레이 (크롭 프레임 밖) */}
          {imgSize.w > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {/* 상단 */}
              <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: framePos.y }} />
              {/* 하단 */}
              <div className="absolute bg-black/50" style={{ top: framePos.y + FRAME_DISPLAY_H, left: 0, right: 0, bottom: 0 }} />
              {/* 좌측 */}
              <div className="absolute bg-black/50" style={{ top: framePos.y, left: 0, width: framePos.x, height: FRAME_DISPLAY_H }} />
              {/* 우측 */}
              <div className="absolute bg-black/50" style={{ top: framePos.y, left: framePos.x + FRAME_DISPLAY_W, right: 0, height: FRAME_DISPLAY_H }} />
            </div>
          )}

          {/* 크롭 프레임 */}
          {imgSize.w > 0 && (
            <div
              className="absolute border-2 border-primary-400 rounded cursor-grab active:cursor-grabbing"
              style={{
                left: framePos.x,
                top: framePos.y,
                width: FRAME_DISPLAY_W,
                height: FRAME_DISPLAY_H,
              }}
              onMouseDown={handleMouseDown}
            >
              {/* 모서리 핸들 */}
              {['tl','tr','bl','br'].map(pos => (
                <div key={pos} className={`absolute w-3 h-3 bg-primary-400 rounded-sm
                  ${pos === 'tl' ? '-top-1.5 -left-1.5' :
                    pos === 'tr' ? '-top-1.5 -right-1.5' :
                    pos === 'bl' ? '-bottom-1.5 -left-1.5' :
                                   '-bottom-1.5 -right-1.5'}`}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <Move className="h-5 w-5 text-primary-300 opacity-80" />
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <Button variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!imgSize.w}>
            모바일 영역 적용
          </Button>
        </div>
      </div>
    </div>
  );
}
