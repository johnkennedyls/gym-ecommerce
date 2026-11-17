import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';
import { UpdatePlanDto, UpsertPlanDto } from './dto/memberships.dto';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { Role } from '../../common/enums';
import { AuditService } from '../../common/services/audit.service';
import { User } from '../users/entities/user.entity';

@ApiTags('memberships')
@Controller('memberships')
export class MembershipsController {
  constructor(
    private readonly service: MembershipsService,
    private readonly audit: AuditService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'RF-10 Planes de membresía activos' })
  publicPlans() {
    return this.service.listPlans();
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'RF-10 Mis membresías' })
  mine(@CurrentUser() user: User) {
    return this.service.myMemberships(user.id);
  }

  @Get('me/active')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'RF-10 Membresía activa del cliente' })
  async active(@CurrentUser() user: User) {
    const membership = await this.service.findActive(user.id);
    return membership ? { id: membership.id, planId: membership.planId, endDate: membership.endDate } : null;
  }

  @Patch(':id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'RF-10 Cancelar una membresía propia' })
  cancel(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(user.id, id);
  }

  @Post('plans')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Crear plan de membresía' })
  async createPlan(@Body() dto: UpsertPlanDto, @CurrentUser() actor: User) {
    const created = await this.service.createPlan(dto);
    await this.audit.record({
      userId: actor.id,
      action: 'MEMBERSHIP_PLAN_CREATED',
      entityName: 'membership_plans',
      entityId: created.id,
      details: { name: created.name },
    });
    return created;
  }

  @Get('admin/plans')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Listar todos los planes' })
  allPlans() {
    return this.service.listAllPlans();
  }

  @Patch('plans/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Modificar o desactivar un plan' })
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() actor: User,
  ) {
    const updated = await this.service.updatePlan(id, dto);
    await this.audit.record({
      userId: actor.id,
      action: 'MEMBERSHIP_PLAN_UPDATED',
      entityName: 'membership_plans',
      entityId: id,
    });
    return updated;
  }
}
