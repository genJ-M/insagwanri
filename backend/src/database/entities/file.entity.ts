import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export type FileFeature = 'profiles' | 'logo' | 'tasks' | 'messages' | 'reports';
export type FileStatus = 'pending' | 'confirmed' | 'deleted';
export type FileRefType = 'task' | 'message' | 'report' | 'user' | 'company';

@Entity('files')
@Index(['companyId', 'feature'], { where: '"deleted_at" IS NULL' })
@Index(['refType', 'refId'], { where: '"deleted_at" IS NULL' })
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;

  @Column({ name: 'original_name', length: 500 })
  originalName: string;

  @Column({ name: 'file_key', type: 'text', unique: true })
  fileKey: string;

  @Column({ length: 100 })
  bucket: string;

  @Column({ name: 'content_type', length: 100 })
  contentType: string;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: number | null;

  @Column({ length: 30 })
  feature: FileFeature;

  @Column({ length: 20, default: 'pending' })
  status: FileStatus;

  @Column({ name: 's3_deleted', default: false })
  s3Deleted: boolean;

  @Column({ name: 'ref_type', type: 'varchar', length: 20, nullable: true })
  refType: FileRefType | null;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ name: 'thumb_key', type: 'text', nullable: true })
  thumbKey: string | null;

  @Column({ name: 'medium_key', type: 'text', nullable: true })
  mediumKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
