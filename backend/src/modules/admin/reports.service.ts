import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { MembershipsService } from '../memberships/memberships.service';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';
import { UsersService } from '../users/users.service';

const DAY_MS = 86_400_000;

/**
 * RF-14 Reportes básicos para la administración: ventas, pedidos, membresías,
 * inventario crítico y ocupación de clases.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly orders: OrdersService,
    private readonly memberships: MembershipsService,
    private readonly bookings: BookingsService,
    private readonly catalog: CatalogService,
    private readonly users: UsersService,
  ) {}

  async dashboard(days = 30, lowStockThreshold = 5) {
    const since = new Date(Date.now() - days * DAY_MS);
    const [revenue, statusRows, topProducts, activeMemberships, lowStock, upcomingBookings, products, usersByRole] =
      await Promise.all([
        this.orders.revenueSince(since),
        this.orders.countByStatus(),
        this.orders.topProducts(since),
        this.memberships.countActive(),
        this.catalog.findLowStock(lowStockThreshold),
        this.bookings.countUpcomingConfirmed(),
        this.catalog.countActiveProducts(),
        this.users.countByRole(),
      ]);

    const ordersByStatus = Object.fromEntries(
      statusRows.map((row) => [row.status, Number(row.total)]),
    ) as Record<string, number>;

    return {
      periodDays: days,
      since,
      sales: {
        revenue: Number(revenue.total),
        paidOrders: Number(revenue.orders),
        averageTicket: Number(revenue.orders) > 0 ? Number(revenue.total) / Number(revenue.orders) : 0,
      },
      ordersByStatus,
      topProducts: topProducts.map((row) => ({
        productName: row.productName,
        quantity: Number(row.quantity),
        revenue: Number(row.revenue),
      })),
      memberships: { active: activeMemberships },
      bookings: { upcomingConfirmed: upcomingBookings },
      inventory: { activeProducts: products, lowStock: lowStock.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock })) },
      usersByRole: Object.fromEntries(usersByRole.map((row) => [row.role, Number(row.total)])),
    };
  }
}
