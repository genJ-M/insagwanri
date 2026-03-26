import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ActivityAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PAGE_VISIT = 'PAGE_VISIT',
  API_CALL = 'API_CALL',
}

/**
 * 통신비밀보호법 — 사용자 활동 로그 (90일 보관 후 자동 삭제)
 *
 * ip_address_encrypted: AES-256-GCM 암호화된 IP 주소
 */
@Entity('user_activity_logs')
@Index(['userId', 'createdAt'])
@Index(['companyId', 'createdAt'])
@Index(['createdAt'])  // 90일 cleanup 쿼리 성능
export class UserActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'varchar', length: 30 })
  action: string;

  /** AES-256-GCM 암호화된 IP 주소 */
  @Column({ name: 'ip_address_encrypted', type: 'text', nullable: true })
  ipAddressEncrypted: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
