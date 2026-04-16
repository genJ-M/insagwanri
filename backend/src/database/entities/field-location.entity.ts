import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum FieldLocCategory {
  CUSTOMER  = 'customer',   // 고객사
  SITE      = 'site',       // 공사/작업 현장
  WAREHOUSE = 'warehouse',  // 물류 창고
  OFFICE    = 'office',     // 협력사 사무소
  OTHER     = 'other',
}

/**
 * 등록된 방문 장소 (company-level)
 * 영업/현장 외근 직원이 GPS 체크인할 때 사용하는 고객사/현장 목록
 */
@Entity('field_locations')
@Index(['companyId', 'isActive'])
export class FieldLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /** 장소명 (예: (주)한빛솔루션 본사, 인천 1공장) */
  @Column({ length: 200 })
  name: string;

  /** 주소 (선택) */
  @Column({ type: 'text', nullable: true })
  address: string | null;

  /** GPS 위도 */
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  /** GPS 경도 */
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  /** 체크인 인정 반경 (m, 기본 300m) */
  @Column({ name: 'radius_m', type: 'smallint', default: 300 })
  radiusM: number;

  /** 장소 카테고리 */
  @Column({ type: 'varchar', length: 20, default: FieldLocCategory.CUSTOMER })
  category: FieldLocCategory;

  /** 활성 여부 (비활성화하면 체크인 목록에서 제외) */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** 메모/설명 */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 등록자 */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;
}
