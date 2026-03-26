import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

/** 첨부 가능한 서류 유형 */
export enum DocumentType {
  RESIDENT_CARD        = 'resident_card',        // 주민등록등본
  FAMILY_RELATION      = 'family_relation',      // 가족관계증명서
  GRADUATION           = 'graduation',           // 졸업증명서
  CAREER_CERT          = 'career_cert',          // 경력증명서
  HEALTH_CHECK         = 'health_check',         // 건강검진결과
  DISABILITY_CERT      = 'disability_cert',      // 장애인증명서
  CONTRACT             = 'contract',             // 근로계약서 사본
  OTHER                = 'other',                // 기타
}

@Entity('user_documents')
@Index(['userId'])
export class UserDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: DocumentType.OTHER,
  })
  type: DocumentType;

  /** 파일 표시 이름 */
  @Column({ name: 'display_name', length: 255 })
  displayName: string;

  /** S3/R2 파일 URL (또는 file_id) */
  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  /** 원본 파일명 */
  @Column({ name: 'original_name', length: 255, nullable: true })
  originalName: string | null;

  /** 파일 크기 (bytes) */
  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
