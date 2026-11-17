import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PublicUser } from './users.service';
import { ChangeRoleDto, ListUsersQueryDto, SetAccountStatusDto, UpdateProfileDto } from './dto/user.dto';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { Role } from '../../common/enums';
import { AuditService } from '../../common/services/audit.service';
import { User } from './entities/user.entity';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'RF-03 Consultar el perfil del usuario autenticado' })
  me(@CurrentUser() user: User): PublicUser {
    return this.usersService.toPublic(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'RF-03 Actualizar la información permitida del perfil' })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto): Promise<PublicUser> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Consultar usuarios con paginación y filtros' })
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query.page, query.limit, query.role, query.search);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Asignar roles' })
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() actor: User,
    @Req() req: { ip?: string },
  ): Promise<PublicUser> {
    const updated = await this.usersService.changeRole(id, dto.role);
    await this.audit.record({
      userId: actor.id,
      action: 'USER_ROLE_CHANGED',
      entityName: 'users',
      entityId: id,
      details: { role: dto.role },
      ipAddress: req.ip ?? null,
    });
    return updated;
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Activar o desactivar cuentas' })
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAccountStatusDto,
    @CurrentUser() actor: User,
    @Req() req: { ip?: string },
  ): Promise<PublicUser> {
    const updated = await this.usersService.setActive(id, dto.isActive);
    await this.audit.record({
      userId: actor.id,
      action: dto.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityName: 'users',
      entityId: id,
      ipAddress: req.ip ?? null,
    });
    return updated;
  }
}
