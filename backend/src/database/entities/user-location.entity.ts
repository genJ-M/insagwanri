import {
  Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { BusinessLocation } from './business-location.entity';

@Entity('user_locations')
export class UserLocation {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @PrimaryColumn({ name: 'location_id' })
  locationId: string;

  /** 주 근무지 여부 (1인 1개만 true) */
  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => BusinessLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: BusinessLocation;
}
