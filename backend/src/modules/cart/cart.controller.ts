import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { User } from '../users/entities/user.entity';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'RF-06 Ver carrito' })
  get(@CurrentUser() user: User) {
    return this.cart.getCart(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'RF-06 Agregar producto o servicio' })
  add(@CurrentUser() user: User, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(user.id, dto.productId, dto.quantity);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'RF-06 Modificar cantidad' })
  update(@CurrentUser() user: User, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.cart.updateQuantity(user.id, itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'RF-06 Retirar ítem' })
  remove(@CurrentUser() user: User, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.cart.removeItem(user.id, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'RF-06 Vaciar carrito' })
  clear(@CurrentUser() user: User) {
    return this.cart.clear(user.id);
  }
}
