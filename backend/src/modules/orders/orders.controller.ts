import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { ChangeOrderStatusDto, CheckoutDto, CreateMembershipOrderDto, ListOrdersQueryDto } from './dto/orders.dto';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { OrderStatus, Role } from '../../common/enums';
import { User } from '../users/entities/user.entity';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'RF-07 Checkout del carrito' })
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user.id, dto);
  }

  @Post('membership')
  @ApiOperation({ summary: 'RF-10 Comprar una membresía' })
  membership(@CurrentUser() user: User, @Body() dto: CreateMembershipOrderDto) {
    return this.orders.createMembershipOrder(user.id, dto.planId);
  }

  @Get()
  @ApiOperation({ summary: 'RF-09 Historial de pedidos del cliente' })
  mine(@CurrentUser() user: User, @Query() query: ListOrdersQueryDto) {
    return this.orders.listForUser(user.id, query);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Listado administrativo de pedidos' })
  admin(@Query() query: ListOrdersQueryDto) {
    return this.orders.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'RF-09 Detalle y estado de un pedido' })
  one(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getOrderAccessibleBy(id, user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'RF-12 Cambiar estado del pedido' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrderStatusDto,
    @CurrentUser() actor: User,
  ) {
    return this.orders.changeStatus(id, dto.status as OrderStatus, { id: actor.id }, dto.note);
  }
}
