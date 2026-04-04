import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum OtpPurpose {
  PASSWORD_RESET = 'password_reset',
}

@Entity('phone_otps')
export class PhoneOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 20 })
  phone: string;

  @Column({ length: 6 })
  code: string;

  @Column({ type: 'varchar', length: 30, default: OtpPurpose.PASSWORD_RESET })
  purpose: OtpPurpose;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  /** OTP 검증 후 발급하는 일회용 리셋 토큰 */
  @Column({ name: 'reset_token', type: 'varchar', length: 64, nullable: true, unique: true })
  resetToken: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
