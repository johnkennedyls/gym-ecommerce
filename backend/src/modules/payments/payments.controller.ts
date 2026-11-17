import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guard';
import { User } from '../users/entities/user.entity';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'RF-08 Pagar un pedido a través de la pasarela' })
  pay(@CurrentUser() user: User, @Body() dto: CreatePaymentDto, @Req() req: Request) {
    return this.payments.pay(user.id, dto, req.ip ?? null);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'RF-08 Comprobante de pago de un pedido' })
  byOrder(@CurrentUser() user: User, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.getPaymentByOrder(orderId, { id: user.id, role: user.role });
  }
}
