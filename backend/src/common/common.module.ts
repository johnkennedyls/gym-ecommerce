import { Global, Module } from '@nestjs/common';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './services/audit.service';
import { TypeOrmModule } from '@nestjs/typeorm';

/** Servicios transversales de trazabilidad, disponibles en todos los módulos. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class CommonModule {}
