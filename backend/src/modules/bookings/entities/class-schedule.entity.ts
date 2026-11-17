import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../catalog/entities/product.entity';
import { Booking } from './booking.entity';

@Entity('class_schedules')
export class ClassSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  title: string;

  /** Servicio del catálogo asociado a la clase; `null` para clases abiertas. */
  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ name: 'product_id', nullable: true })
  productId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'trainer_id' })
  trainer: User | null;

  @Column({ name: 'trainer_id', nullable: true })
  trainerId: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ name: 'capacity', type: 'int' })
  capacity: number;

  @Column({ name: 'room', type: 'varchar', length: 60, nullable: true })
  room: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => Booking, (booking) => booking.schedule)
  bookings: Booking[];
}
