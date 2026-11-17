import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus, OrderType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 24 })
  code: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: OrderType, default: OrderType.CATALOG })
  type: OrderType;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT })
  status: OrderStatus;

  @Column({ name: 'subtotal', type: 'numeric', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ name: 'total', type: 'numeric', precision: 12, scale: 2 })
  total: string;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  @Column({ name: 'shipping_address', type: 'varchar', length: 240, nullable: true })
  shippingAddress: string | null;

  @Column({ name: 'receiver_name', type: 'varchar', length: 140, nullable: true })
  receiverName: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];
}
