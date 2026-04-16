import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export type NotificationType =
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_completed'
  | 'task_urgent'
  | 'report_feedback'
  | 'message_mention'
  | 'message_dm'
  | 'channel_announcement'
  | 'schedule_reminder'
  | 'schedule_new'
  | 'attendance_late'
  | 'attendance_absent'
  | 'tax_deadline'
  | 'labor_event'
  | 'task_instruction'
  | 'task_time_adjust_request'
  | 'task_time_adjust_approved'
  | 'task_time_adjust_rejected'
  | 'birthday_upcoming'
  | 'team_member_added'
  | 'team_leader_assigned'
  | 'attendance_clock_in_reminder'
  | 'annual_leave_expiry_warning'   // 연가 소진 독촉 알림
  | 'shift_handover_requested'      // 교대 인수인계 요청
  | 'shift_handover_from_signed'    // 인계자 서명 완료
  | 'shift_handover_completed'      // 양방 서명 완료
  | 'shift_handover_disputed'        // 이의 제기
  | 'weekly_holiday_pay'            // 주휴수당 발생 알림 (파트타임)
  | 'field_checkin_out_of_range'    // 현장 범위 밖 체크인 (외근직)
  | 'care_license_expiring'         // 자격증 만료 임박 (의료·돌봄직)
  | 'care_fatigue_warning'          // 누적 피로도 경고 (의료·돌봄직)
  | 'schedule_missing_warning'      // 근무표 미작성 경고 (관리자)
  | 'shift_swap_requested'          // 근무 교환 신청 받음 (B에게)
  | 'shift_swap_peer_accepted'      // 상대방 수락 → 업주 승인 필요 (A에게 + 업주에게)
  | 'shift_swap_peer_declined'      // 상대방 거절 (A에게)
  | 'shift_swap_cover_posted'       // 대타 모집 게시 (같은 회사 직원 전체)
  | 'shift_swap_volunteered'        // 대타 자원자 등장 → 업주 승인 필요 (A에게 + 업주에게)
  | 'shift_swap_approved'           // 업주 최종 승인 (A·B 양쪽에게)
  | 'shift_swap_rejected'           // 업주 거절 (A에게)
  | 'subscription_renewing_soon'    // 결제일 D-7/D-3/D-1 사전 알림
  | 'subscription_renewed'          // 자동결제 성공 알림
  | 'subscription_renewal_failed'   // 자동결제 실패 알림
  | 'trial_ending_soon'             // 체험 기간 만료 임박 D-3/D-1
  | 'subscription_payment_method_expiring'; // 카드 유효기간 만료 임박

export type NotificationRefType =
  | 'task'
  | 'task_report'
  | 'message'
  | 'schedule'
  | 'payment'
  | 'subscription'
  | 'shift_handover'
  | 'shift_assignment'
  | 'shift_swap'
  | 'field_visit'
  | 'field_location'
  | 'care_license'
  | 'care_session';

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 50 })
  type: NotificationType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'ref_type', type: 'varchar', length: 20, nullable: true })
  refType: NotificationRefType | null;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
