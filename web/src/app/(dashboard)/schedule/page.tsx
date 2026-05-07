import { redirect } from 'next/navigation';

/**
 * /schedule → /calendar 통합. 캘린더 모달이 시간 단위 + RRULE + 알림까지
 * 모두 지원하므로 별도 진입점이 필요하지 않음.
 */
export default function SchedulePage() {
  redirect('/calendar');
}
