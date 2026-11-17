import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { Role } from '../../common/enums';
import { AuditService } from '../../common/services/audit.service';

class DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  lowStockThreshold = 5;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'RF-14 Reportes de ventas, pedidos, membresías e inventario' })
  dashboard(@Query() query: DashboardQueryDto) {
    return this.reports.dashboard(query.days, query.lowStockThreshold);
  }

  @Get('audit')
  @ApiOperation({ summary: 'RNF-09 Bitácora de eventos administrativos' })
  auditLog(@Query('limit') limit?: string) {
    return this.audit.listLatest(limit ? Number(limit) : 100);
  }
}
