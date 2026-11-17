import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export type AuditInput = {
  userId?: string | null;
  action: string;
  entityName?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/** Trazabilidad de eventos administrativos y transaccionales (RNF-09). */
@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repository: Repository<AuditLog>) {}

  async record(input: AuditInput): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({
          userId: input.userId ?? null,
          action: input.action,
          entityName: input.entityName ?? null,
          entityId: input.entityId ?? null,
          details: input.details ?? null,
          ipAddress: input.ipAddress ?? null,
        }),
      );
    } catch {
      // La bitácora no debe romper la operación de negocio; el fallo se delega al logger de la aplicación.
    }
  }

  listLatest(limit = 100): Promise<AuditLog[]> {
    return this.repository.find({ order: { createdAt: 'DESC' }, take: Math.min(limit, 500) });
  }
}
