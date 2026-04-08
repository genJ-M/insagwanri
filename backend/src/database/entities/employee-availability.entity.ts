import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity('employee_availability')
@Index(['companyId', 'userId'])
@Index(['companyId', 'dayOfWeek'])
export class EmployeeAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  /**
   * 요일 기반 반복 가용시간 (0=일, 1=월, ..., 6=토)
   * specificDate 가 있으면 그날 단건 예외처리
   */
  @Column({ name: 'day_of_week', type: 'smallint', nullable: true })
  dayOfWeek: number | null;

  /** 특정 날짜 가용시간 (요일 설정을 오버라이드) */
  @Column({ name: 'specific_date', type: 'date', nullable: true })
  specificDate: string | null;

  /** HH:mm 형식 */
  @Column({ name: 'start_time', type: 'varchar', length: 5 })
  startTime: string;

  /** HH:mm 형식 */
  @Column({ name: 'end_time', type: 'varchar', length: 5 })
  endTime: string;

  /** false = 해당 시간대 불가 (휴가·외부 약속 등) */
  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 유효 기간 시작 (null = 무기한) */
  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: string | null;

  /** 유효 기간 종료 (null = 무기한) */
  @Column({ name: 'effective_until', type: 'date', nullable: true })
  effectiveUntil: string | null;

  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @ManyToOne(() => User)    @JoinColumn({ name: 'user_id' })    user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
