import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';

export enum CompanyPlan {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'business_number', type: 'varchar', length: 20, unique: true, nullable: true })
  businessNumber: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industry: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ name: 'cover_image_mobile_url', type: 'text', nullable: true })
  coverImageMobileUrl: string | null;

  @Column({ name: 'cover_mobile_crop', type: 'jsonb', nullable: true })
  coverMobileCrop: { x: number; y: number; width: number; height: number } | null;

  @Column({ name: 'branding_text_color', type: 'varchar', length: 7, default: '#FFFFFF' })
  brandingTextColor: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: CompanyPlan.FREE,
  })
  plan: CompanyPlan;

  @Column({ name: 'plan_started_at', type: 'timestamptz', nullable: true })
  planStartedAt: Date | null;

  @Column({ name: 'plan_expires_at', type: 'timestamptz', nullable: true })
  planExpiresAt: Date | null;

  @Column({ name: 'max_members', type: 'smallint', default: 5 })
  maxMembers: number;

  @Column({ name: 'work_start_time', type: 'time', default: '09:00' })
  workStartTime: string;

  @Column({ name: 'work_end_time', type: 'time', default: '18:00' })
  workEndTime: string;

  @Column({ name: 'late_threshold_min', type: 'smallint', default: 10 })
  lateThresholdMin: number;

  @Column({ length: 50, default: 'Asia/Seoul' })
  timezone: string;

  @Column({
    name: 'work_days',
    type: 'smallint',
    array: true,
    default: () => "'{1,2,3,4,5}'",
  })
  workDays: number[];

  @Column({
    type: 'varchar',
    length: 20,
    default: CompanyStatus.ACTIVE,
  })
  status: CompanyStatus;

  @Column({ name: 'gps_enabled', default: false })
  gpsEnabled: boolean;

  @Column({ name: 'gps_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLat: number | null;

  @Column({ name: 'gps_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  gpsLng: number | null;

  @Column({ name: 'gps_radius_m', type: 'smallint', default: 100 })
  gpsRadiusM: number;

  @Column({ name: 'gps_strict_mode', default: false })
  gpsStrictMode: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
