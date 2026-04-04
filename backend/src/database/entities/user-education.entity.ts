import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum DegreeType {
  HIGH_SCHOOL   = 'high_school',
  ASSOCIATE     = 'associate',
  BACHELOR      = 'bachelor',
  MASTER        = 'master',
  DOCTORATE     = 'doctorate',
  OTHER         = 'other',
}

@Entity('user_educations')
@Index(['userId'])
export class UserEducation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'school_name', length: 200 })
  schoolName: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  major: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: DegreeType.BACHELOR,
  })
  degree: DegreeType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** 재학 중 */
  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent: boolean;

  /** 졸업 상태: graduated | enrolled | dropout */
  @Column({ length: 20, default: 'graduated' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
