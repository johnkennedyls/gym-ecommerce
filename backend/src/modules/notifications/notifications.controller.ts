import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { User } from '../users/entities/user.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'RF-15 Bandeja de notificaciones del usuario' })
  async list(@CurrentUser() user: User, @Query('limit') limit?: string) {
    const items = await this.service.listForUser(user.id, limit ? Number(limit) : 30);
    return { items, unread: await this.service.unreadCount(user.id) };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'RF-15 Marcar notificación como leída' })
  markAsRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.markAsRead(user.id, id);
  }
}
