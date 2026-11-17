import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MembershipLevel } from '../../../common/enums';
import { UserMembership } from './user-membership.entity';

@Entity('membership_plans')
export class MembershipPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  @Column({ name: 'duration_days', type: 'int' })
  durationDays: number;

  @Column({ name: 'access_level', type: 'enum', enum: MembershipLevel, default: MembershipLevel.BASIC })
  accessLevel: MembershipLevel;

  @Column({ name: 'includes_classes', default: false })
  includesClasses: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => UserMembership, (membership) => membership.plan)
  memberships: UserMembership[];
}
