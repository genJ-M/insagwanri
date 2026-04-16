import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { FieldLocation } from './field-location.entity';

export enum VehicleEventType {
  IGNITION_ON  = 'ignition_on',   // 시동 ON
  IGNITION_OFF = 'ignition_off',  // 시동 OFF
}

/**
 * 현장 방문 기록 (개인별 체크인/체크아웃)
 * - 등록된 FieldLocation에 GPS 체크인 → 업무 보고서 트리거
 * - 미등록 위치도 "spot visit"로 저장 가능
 */
@Entity('field_visits')
@Index(['companyId', 'userId', 'visitDate'])
@Index(['userId', 'checkedInAt'])
export class FieldVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 방문일 (KST YYYY-MM-DD) */
  @Column({ name: 'visit_date', type: 'date' })
  visitDate: string;

  /** 연결된 등록 방문지 (없으면 null → spot visit) */
  @Column({ name: 'field_location_id', type: 'uuid', nullable: true })
  fieldLocationId: string | null;

  @ManyToOne(() => FieldLocation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'field_location_id' })
  fieldLocation: FieldLocation | null;

  /** 체크인 시각 (UTC) */
  @Column({ name: 'checked_in_at', type: 'timestamptz' })
  checkedInAt: Date;

  /** 체크아웃 시각 (UTC, null = 아직 체크아웃 안 함) */
  @Column({ name: 'checked_out_at', type: 'timestamptz', nullable: true })
  checkedOutAt: Date | null;

  /** 체크인 GPS 위도 */
  @Column({ name: 'in_lat', type: 'decimal', precision: 10, scale: 7 })
  inLat: number;

  /** 체크인 GPS 경도 */
  @Column({ name: 'in_lng', type: 'decimal', precision: 10, scale: 7 })
  inLng: number;

  /** 체크아웃 GPS 위도 */
  @Column({ name: 'out_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  outLat: number | null;

  /** 체크아웃 GPS 경도 */
  @Column({ name: 'out_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  outLng: number | null;

  /** 체크인 시 등록 방문지와의 거리 (m) */
  @Column({ name: 'in_distance_m', type: 'smallint', nullable: true })
  inDistanceM: number | null;

  /** 반경 밖 체크인 여부 (flag-not-reject 정책) */
  @Column({ name: 'is_out_of_range', default: false })
  isOutOfRange: boolean;

  /** 방문 목적/메모 */
  @Column({ type: 'text', nullable: true })
  purpose: string | null;

  /** 연결된 업무 보고서 Task ID (자동 생성) */
  @Column({ name: 'linked_task_id', type: 'uuid', nullable: true })
  linkedTaskId: string | null;

  /** 차량 이벤트 목록 (JSONB) [{type, ts, lat, lng, obd_speed}] */
  @Column({ name: 'vehicle_events', type: 'jsonb', default: [] })
  vehicleEvents: Array<{
    type: VehicleEventType;
    ts: string;         // ISO timestamp
    lat?: number;
    lng?: number;
    obdSpeed?: number;  // km/h (OBD 연동 시)
  }>;

  /** 방문 중 이동 경로 포인트 (JSONB, 선택적 GPS 트래킹) */
  @Column({ name: 'route_points', type: 'jsonb', default: [] })
  routePoints: Array<{ lat: number; lng: number; ts: string }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
