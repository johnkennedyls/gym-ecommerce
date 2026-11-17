import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../catalog/entities/product.entity';
import { MembershipPlan } from '../../memberships/entities/membership-plan.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  /** Artículo del catálogo; vacío cuando la línea corresponde a una membresía. */
  @ManyToOne(() => Product, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({ name: 'product_id', nullable: true })
  productId: string | null;

  @ManyToOne(() => MembershipPlan, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: MembershipPlan | null;

  @Column({ name: 'plan_id', nullable: true })
  planId: string | null;

  @Column({ name: 'product_name', length: 140 })
  productName: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2 })
  lineTotal: string;
}
