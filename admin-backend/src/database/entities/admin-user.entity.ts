import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  OPERATIONS = 'operations',
  BILLING = 'billing',
  SUPPORT = 'support',
  READONLY = 'readonly',
}

@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'varchar',
    length: 30,
    enum: AdminRole,
    default: AdminRole.READONLY,
  })
  role: AdminRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // TOTP MFA
  @Column({ name: 'totp_secret', length: 64, nullable: true })
  totpSecret: string | null;

  @Column({ name: 'totp_enabled', default: false })
  totpEnabled: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
