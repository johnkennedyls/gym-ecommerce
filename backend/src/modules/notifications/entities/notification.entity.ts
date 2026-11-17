import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationEvent } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationEvent })
  event: NotificationEvent;

  @Column({ length: 140 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'channel', type: 'varchar', length: 20, default: 'email' })
  channel: string;

  /** `SENT` cuando el transporte confirmó la entrega, `FAILED` en caso contrario. */
  @Column({ name: 'delivery_status', type: 'varchar', length: 20, default: 'PENDING' })
  deliveryStatus: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
