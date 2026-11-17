import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';
import { CatalogService } from '../catalog/catalog.service';
import { MembershipsService } from '../memberships/memberships.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../../common/services/audit.service';
import { calculateTotals } from '../cart/cart-calculator';
import { NotificationEvent, OrderStatus, OrderType, ProductKind, Role } from '../../common/enums';
import { PaginatedResult, paginate } from '../../common/dto/pagination';
import { CheckoutDto, ListOrdersQueryDto } from './dto/orders.dto';
import { randomBytes } from 'crypto';

export type OrderLineView = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderView = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  type: OrderType;
  subtotal: number;
  total: number;
  currency: string;
  shippingAddress: string | null;
  receiverName: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderLineView[];
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: 'pendiente de pago',
  [OrderStatus.PAID]: 'pagado',
  [OrderStatus.PREPARING]: 'en preparación',
  [OrderStatus.SHIPPED]: 'enviado',
  [OrderStatus.COMPLETED]: 'completado',
  [OrderStatus.CANCELLED]: 'cancelado',
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

const generateCode = (): string => {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `O-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly memberships: MembershipsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** RF-07 Checkout: congela el carrito en un pedido dentro de una sola transacción. */
  async checkout(userId: string, dto: CheckoutDto): Promise<OrderView> {
    const { cart, items } = await this.cart.loadWithItems(userId);
    if (items.length === 0) throw new BadRequestException('El carrito está vacío');

    const products = await this.catalog.findProductsByIds([...new Set(items.map((item) => item.productId))]);
    const byId = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) throw new NotFoundException(`El artículo ${item.productName} ya no está disponible`);
      if (!product.isActive) throw new BadRequestException(`${product.name} no está disponible para compra`);
      if (product.kind === ProductKind.PRODUCT && product.stock !== null && product.stock < item.quantity) {
        throw new ConflictException(`Quedan ${product.stock} unidades de ${product.name}`);
      }
      item.unitPrice = product.price;
    }

    const lines = items.map((item) => ({
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
    }));
    const totals = calculateTotals(lines);

    const order = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Order, {
          code: generateCode(),
          userId,
          type: OrderType.CATALOG,
          status: OrderStatus.PENDING_PAYMENT,
          subtotal: totals.subtotal.toFixed(2),
          total: totals.total.toFixed(2),
          currency: 'COP',
          shippingAddress: dto.shippingAddress,
          receiverName: dto.receiverName,
        }),
      );

      for (const item of items) {
        const lineTotal = calculateTotals([{ unitPrice: Number(item.unitPrice), quantity: item.quantity }]).total;
        await manager.save(
          manager.create(OrderItem, {
            orderId: saved.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: lineTotal.toFixed(2),
          }),
        );
      }

      await this.cart.emptyCart(cart.id);
      return saved.id;
    });

    await this.notifications.notify(
      userId,
      NotificationEvent.ORDER_CREATED,
      'Pedido registrado',
      `Tu pedido quedó pendiente de pago. Total por pagar: $${totals.total.toLocaleString('es-CO')}.`,
    );
    await this.audit.record({
      userId,
      action: 'ORDER_CREATED',
      entityName: 'orders',
      entityId: order,
      details: { total: totals.total, items: items.length },
    });

    return this.getOrderForUser(userId, order);
  }

  /** RF-10 Compra de membresía: genera un pedido específico que se paga por la misma pasarela. */
  async createMembershipOrder(userId: string, planId: string): Promise<OrderView> {
    const plan = await this.memberships.getPlanEntity(planId);
    if (!plan.isActive) throw new BadRequestException('El plan de membresía no está disponible');

    const order = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Order, {
          code: generateCode(),
          userId,
          type: OrderType.MEMBERSHIP,
          status: OrderStatus.PENDING_PAYMENT,
          subtotal: plan.price,
          total: plan.price,
          currency: plan.currency,
        }),
      );
      await manager.save(
        manager.create(OrderItem, {
          orderId: saved.id,
          planId: plan.id,
          productName: `Membresía ${plan.name} (${plan.durationDays} días)`,
          quantity: 1,
          unitPrice: plan.price,
          lineTotal: plan.price,
        }),
      );
      return saved.id;
    });

    await this.audit.record({
      userId,
      action: 'MEMBERSHIP_ORDER_CREATED',
      entityName: 'orders',
      entityId: order,
      details: { planId: plan.id },
    });
    return this.getOrderForUser(userId, order);
  }

  /**
   * RF-08 / RNF-08 Consume el pago aprobado: descuenta inventario y activa membresías.
   * Es idempotente: un segundo intento no vuelve a afectar el stock.
   */
  async markPaid(orderId: string): Promise<OrderView> {
    const activated = await this.dataSource.transaction(async (manager) => {
      const order = await manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id: orderId })
        .getOne();
      if (!order) throw new NotFoundException('El pedido no existe');
      if (order.status !== OrderStatus.PENDING_PAYMENT) return null;

      const items = await manager.find(OrderItem, { where: { orderId: order.id } });
      for (const item of items) {
        if (item.productId) {
          await this.catalog.consumeStock(manager, {
            productId: item.productId,
            quantity: item.quantity,
            orderCode: order.code,
            userId: order.userId,
          });
        }
      }

      order.status = OrderStatus.PAID;
      await manager.save(order);

      const membershipItem = items.find((item) => item.planId);
      const membership = membershipItem?.planId
        ? await this.memberships.activateWithin(manager, order.userId, membershipItem.planId)
        : null;

      return { order, membership };
    });

    if (!activated) return this.getOrderView(orderId);

    await this.notifications.notify(
      activated.order.userId,
      NotificationEvent.PAYMENT_APPROVED,
      'Pago aprobado',
      `Tu pedido ${activated.order.code} fue pagado correctamente.`,
    );

    if (activated.membership) {
      await this.notifications.notify(
        activated.order.userId,
        NotificationEvent.MEMBERSHIP_ACTIVATED,
        'Membresía activada',
        `Tu membresía ${activated.membership.plan?.name ?? ''} está activa hasta ${activated.membership.endDate.toISOString().slice(0, 10)}.`,
      );
    }

    await this.audit.record({
      userId: activated.order.userId,
      action: 'ORDER_PAID',
      entityName: 'orders',
      entityId: orderId,
      details: { code: activated.order.code, total: Number(activated.order.total) },
    });
    return this.getOrderView(orderId);
  }

  /** RF-08 Pedido pendiente que puede recibir un pago, validando propiedad. */
  async getPayableOrder(orderId: string, userId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new NotFoundException('El pedido no existe');
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('El pedido no está pendiente de pago');
    }
    return order;
  }

  /** RF-09 Historial del cliente. */
  async listForUser(userId: string, query: ListOrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    const builder = this.orders
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    if (query.status) builder.andWhere('order.status = :status', { status: query.status });

    const [rows, total] = await builder.getManyAndCount();
    return paginate(await this.decorate(rows), total, query.page, query.limit);
  }

  async getOrderForUser(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.orders.findOne({ where: { id: orderId, userId }, relations: { items: true } });
    if (!order) throw new NotFoundException('El pedido no existe');
    return (await this.decorate([order]))[0];
  }

  /** RF-09 El cliente solo ve sus pedidos; el administrador puede ver cualquiera. */
  async getOrderAccessibleBy(orderId: string, requester: { id: string; role: Role }): Promise<OrderView> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: { items: true } });
    if (!order) throw new NotFoundException('El pedido no existe');
    if (order.userId !== requester.id && requester.role !== Role.ADMIN) {
      throw new NotFoundException('El pedido no existe');
    }
    return (await this.decorate([order]))[0];
  }

  private async getOrderView(orderId: string): Promise<OrderView> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: { items: true } });
    if (!order) throw new NotFoundException('El pedido no existe');
    return (await this.decorate([order]))[0];
  }

  /** RF-09 Consulta de estado con trazabilidad de líneas. */
  private async decorate(orders: Order[]): Promise<OrderView[]> {
    if (orders.length === 0) return [];
    const items = await this.orderItems.find({ where: { orderId: In(orders.map((order) => order.id)) } });
    const grouped = new Map<string, OrderItem[]>();
    for (const item of items) {
      grouped.set(item.orderId, [...(grouped.get(item.orderId) ?? []), item]);
    }

    return orders.map((order) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      statusLabel: STATUS_LABEL[order.status],
      type: order.type,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      currency: order.currency,
      shippingAddress: order.shippingAddress ?? null,
      receiverName: order.receiverName ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (grouped.get(order.id) ?? []).map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    }));
  }

  // ------------------------------------------------------------------ administración

  async listForAdmin(query: ListOrdersQueryDto): Promise<PaginatedResult<OrderView>> {
    const builder = this.orders
      .createQueryBuilder('order')
      .orderBy('order.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    if (query.status) builder.andWhere('order.status = :status', { status: query.status });
    if (query.userId) builder.andWhere('order.userId = :userId', { userId: query.userId });
    if (query.search) builder.andWhere('order.code ILIKE :term', { term: `%${query.search}%` });

    const [rows, total] = await builder.getManyAndCount();
    return paginate(await this.decorate(rows), total, query.page, query.limit);
  }

  async changeStatus(
    orderId: string,
    status: OrderStatus,
    actor: { id: string },
    note?: string,
  ): Promise<OrderView> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: { items: true } });
    if (!order) throw new NotFoundException('El pedido no existe');

    if (order.status === status) return this.getOrderView(orderId);
    if (!TRANSITIONS[order.status].includes(status)) {
      throw new BadRequestException(
        `El pedido ${order.code} no puede pasar de ${STATUS_LABEL[order.status]} a ${STATUS_LABEL[status]}`,
      );
    }

    if (status === OrderStatus.CANCELLED) {
      await this.dataSource.transaction(async (manager) => {
        const items = await manager.find(OrderItem, { where: { orderId: order.id } });
        for (const item of items) {
          if (item.productId && order.status !== OrderStatus.PENDING_PAYMENT) {
            await this.catalog.restoreStock(manager, {
              productId: item.productId,
              quantity: item.quantity,
              orderCode: order.code,
              userId: actor.id,
            });
          }
        }
        await manager.update(Order, { id: order.id }, { status, cancelledAt: new Date() });
      });
    } else {
      order.status = status;
      await this.orders.save(order);
    }

    await this.notifications.notify(
      order.userId,
      NotificationEvent.ORDER_STATUS_CHANGED,
      'Actualización de tu pedido',
      `El pedido ${order.code} ahora está ${STATUS_LABEL[status]}.`,
    );
    await this.audit.record({
      userId: actor.id,
      action: 'ORDER_STATUS_CHANGED',
      entityName: 'orders',
      entityId: order.id,
      details: { from: order.status, to: status, note: note ?? null, code: order.code },
      ipAddress: null,
    });
    return this.getOrderView(orderId);
  }

  countByStatus(): Promise<{ status: OrderStatus; total: string }[]> {
    return this.orders
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('order.status')
      .getRawMany();
  }

  revenueSince(since: Date): Promise<{ total: string; orders: string }> {
    return this.orders
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.total), 0)', 'total')
      .addSelect('COUNT(*)', 'orders')
      .where('order.status IN (:...paid)', {
        paid: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.COMPLETED],
      })
      .andWhere('order.createdAt >= :since', { since })
      .getRawOne<{ total: string; orders: string }>()
      .then((row) => row ?? { total: '0', orders: '0' });
  }

  topProducts(since: Date, limit = 5): Promise<{ productName: string; quantity: string; revenue: string }[]> {
    return this.orderItems
      .createQueryBuilder('item')
      .innerJoin(Order, 'order', 'order.id = item.orderId')
      .select('item.productName', 'productName')
      .addSelect('SUM(item.quantity)', 'quantity')
      .addSelect('SUM(item.lineTotal)', 'revenue')
      .where('order.status IN (:...paid)', {
        paid: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.COMPLETED],
      })
      .andWhere('order.createdAt >= :since', { since })
      .groupBy('item.productName')
      .orderBy('revenue', 'DESC')
      .limit(limit)
      .getRawMany();
  }

}
