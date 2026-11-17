import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Bitácora de eventos administrativos y transaccionales (RNF-09 trazabilidad). */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @Column({ length: 60 })
  action: string;

  @Column({ name: 'entity_name', type: 'varchar', length: 60, nullable: true })
  entityName: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 80, nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 60, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
