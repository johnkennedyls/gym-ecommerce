import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod, PaymentStatus } from '../../../common/enums';
import { Order } from '../../orders/entities/order.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.CREATED })
  status: PaymentStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  @Column({ name: 'method', type: 'enum', enum: PaymentMethod, default: PaymentMethod.CARD })
  method: PaymentMethod;

  /** Identificador devuelto por la pasarela externa. */
  @Column({ name: 'gateway_reference', type: 'varchar', length: 80, nullable: true })
  gatewayReference: string | null;

  @Column({ name: 'gateway_name', length: 40 })
  gatewayName: string;

  /** Datos sensibles enmascarados: nunca se persiste el PAN completo (PCI-DSS / RNF-10). */
  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 160, nullable: true })
  failureReason: string | null;

  /** Clave de idempotencia enviada por el cliente para evitar cobros duplicados. */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 80, nullable: true, unique: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
