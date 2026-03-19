import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // 채널별 ON/OFF
  @Column({ name: 'push_enabled', default: true })
  pushEnabled: boolean;

  @Column({ name: 'email_enabled', default: true })
  emailEnabled: boolean;

  // 기능별 푸시 설정
  @Column({ name: 'push_task', default: true })
  pushTask: boolean;

  @Column({ name: 'push_message', default: true })
  pushMessage: boolean;

  @Column({ name: 'push_schedule', default: true })
  pushSchedule: boolean;

  @Column({ name: 'push_attendance', default: true })
  pushAttendance: boolean;

  // 기능별 이메일 설정
  @Column({ name: 'email_task', default: false })
  emailTask: boolean;

  @Column({ name: 'email_weekly_report', default: true })
  emailWeeklyReport: boolean;

  // 방해 금지 시간 (KST 기준)
  @Column({ name: 'dnd_enabled', default: false })
  dndEnabled: boolean;

  @Column({ name: 'dnd_start_time', type: 'time', default: '22:00' })
  dndStartTime: string;

  @Column({ name: 'dnd_end_time', type: 'time', default: '08:00' })
  dndEndTime: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
