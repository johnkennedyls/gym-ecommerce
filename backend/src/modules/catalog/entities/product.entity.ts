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
import { ProductKind } from '../../../common/enums';
import { Category } from './category.entity';
import { StockMovement } from './stock-movement.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 140 })
  name: string;

  @Column({ unique: true, length: 40 })
  sku: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @Column({ type: 'varchar', length: 3, default: 'COP' })
  currency: string;

  @Column({ name: 'image_url', type: 'varchar', length: 300, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'enum', enum: ProductKind, default: ProductKind.PRODUCT })
  kind: ProductKind;

  /** Stock físico. `null` indica que el artículo no controla inventario (servicios). */
  @Column({ type: 'int', nullable: true })
  stock: number | null;

  /** Duración en minutos de los servicios de entrenamiento. */
  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => Category, (category) => category.products, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: string;

  @OneToMany(() => StockMovement, (movement) => movement.product)
  stockMovements: StockMovement[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
