// El seed y TypeORM CLI se ejecutan sin `main.ts`: aquí se carga .env antes de leer el entorno.
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { loadEnvironment } from '../config/environment';
import { User } from '../modules/users/entities/user.entity';
import { RefreshTokenEntity } from '../modules/auth/entities/refresh-token.entity';
import { PasswordResetToken } from '../modules/auth/entities/password-reset-token.entity';
import { Category } from '../modules/catalog/entities/category.entity';
import { Product } from '../modules/catalog/entities/product.entity';
import { StockMovement } from '../modules/catalog/entities/stock-movement.entity';
import { MembershipPlan } from '../modules/memberships/entities/membership-plan.entity';
import { UserMembership } from '../modules/memberships/entities/user-membership.entity';
import { Cart } from '../modules/cart/entities/cart.entity';
import { CartItem } from '../modules/cart/entities/cart-item.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { OrderItem } from '../modules/orders/entities/order-item.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { ClassSchedule } from '../modules/bookings/entities/class-schedule.entity';
import { Booking } from '../modules/bookings/entities/booking.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { AuditLog } from '../common/entities/audit-log.entity';

export const appDataSource = new DataSource({
  type: 'postgres',
  ...(() => {
    const environment = loadEnvironment();
    return {
      host: environment.database.host,
      port: environment.database.port,
      username: environment.database.user,
      password: environment.database.password,
      database: environment.database.name,
    };
  })(),
  entities: [
    User,
    RefreshTokenEntity,
    PasswordResetToken,
    Category,
    Product,
    StockMovement,
    MembershipPlan,
    UserMembership,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Payment,
    ClassSchedule,
    Booking,
    Notification,
    AuditLog,
  ],
  synchronize: true,
});
