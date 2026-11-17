import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BookingStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { ClassSchedule } from './class-schedule.entity';

@Entity('bookings')
@Unique('UQ_booking_user_schedule', ['userId', 'scheduleId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => ClassSchedule, (schedule) => schedule.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: ClassSchedule;

  @Column({ name: 'schedule_id' })
  scheduleId: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
