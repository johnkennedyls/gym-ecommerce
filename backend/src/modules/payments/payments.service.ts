import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway.port';
import { CreatePaymentDto } from './dto/payment.dto';
import { OrderView, OrdersService } from '../orders/orders.service';
import { NotificationEvent, PaymentStatus, Role } from '../../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../../common/services/audit.service';

export type PaymentView = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  gateway: string;
  reference: string | null;
  cardLast4: string | null;
  failureReason: string | null;
  createdAt: Date;
};

const toPaymentView = (payment: Payment): PaymentView => ({
  id: payment.id,
  orderId: payment.orderId,
  status: payment.status,
  amount: Number(payment.amount),
  currency: payment.currency,
  gateway: payment.gatewayName,
  reference: payment.gatewayReference ?? null,
  cardLast4: payment.cardLast4 ?? null,
  failureReason: payment.failureReason ?? null,
  createdAt: payment.createdAt,
});

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** RF-08 Cobra un pedido mediante la pasarela y registra el resultado de la transacción. */
  async pay(userId: string, dto: CreatePaymentDto, ip: string | null): Promise<{ payment: PaymentView; order: OrderView }> {
    // RNF-08: la clave de idempotencia se evalúa antes de tocar el pedido para que un
    // reintento de una transacción aprobada devuelva el mismo resultado sin efectos extra.
    if (dto.idempotencyKey) {
      const previous = await this.payments.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
      if (previous) {
        await this.orders.getOrderForUser(userId, previous.orderId);
        if (previous.status === PaymentStatus.APPROVED) {
          return { payment: toPaymentView(previous), order: await this.orders.markPaid(previous.orderId) };
        }
        throw new BadRequestException('Esta transacción ya fue procesada y no fue aprobada');
      }
    }

    const order = await this.orders.getPayableOrder(dto.orderId, userId);
    const amount = Number(order.total);

    const digits = dto.card.number.replace(/\D/g, '');
    const payment = await this.payments.save(
      this.payments.create({
        orderId: order.id,
        amount: amount.toFixed(2),
        currency: order.currency,
        status: PaymentStatus.CREATED,
        gatewayName: this.gateway.name,
        cardLast4: digits.slice(-4),
        idempotencyKey: dto.idempotencyKey ?? null,
      }),
    );

    const result = await this.gateway.charge({
      orderCode: order.code,
      amount,
      currency: order.currency,
      card: {
        number: digits,
        holderName: dto.card.holderName,
        expiryMonth: dto.card.expiryMonth,
        expiryYear: dto.card.expiryYear,
        cvv: dto.card.cvv,
      },
    });

    payment.status =
      result.status === 'APPROVED'
        ? PaymentStatus.APPROVED
        : result.status === 'DECLINED'
          ? PaymentStatus.DECLINED
          : PaymentStatus.ERROR;
    payment.gatewayReference = result.reference;
    payment.failureReason = result.message;
    await this.payments.save(payment);

    if (payment.status !== PaymentStatus.APPROVED) {
      await this.notifications.notify(
        userId,
        NotificationEvent.PAYMENT_DECLINED,
        'Pago rechazado',
        `No pudimos procesar el pago del pedido ${order.code}. ${result.message ?? 'Intenta con otro medio de pago.'}`,
      );
      await this.audit.record({
        userId,
        action: 'PAYMENT_REJECTED',
        entityName: 'payments',
        entityId: payment.id,
        details: { orderCode: order.code, reason: result.message },
        ipAddress: ip,
      });
      return { payment: toPaymentView(payment), order: await this.orders.getOrderForUser(userId, order.id) };
    }

    const paidOrder = await this.orders.markPaid(order.id);
    await this.audit.record({
      userId,
      action: 'PAYMENT_APPROVED',
      entityName: 'payments',
      entityId: payment.id,
      details: { orderCode: order.code, reference: result.reference, amount },
      ipAddress: ip,
    });

    return { payment: toPaymentView(payment), order: paidOrder };
  }

  /** RF-08 Consulta del comprobante de pago de un pedido. */
  async getPaymentByOrder(orderId: string, requester: { id: string; role: Role }): Promise<PaymentView | null> {
    await this.orders.getOrderAccessibleBy(orderId, requester);
    const payment = await this.payments.findOne({ where: { orderId }, order: { createdAt: 'DESC' } });
    return payment ? toPaymentView(payment) : null;
  }

  countApproved(): Promise<number> {
    return this.payments.count({ where: { status: PaymentStatus.APPROVED } });
  }
}
