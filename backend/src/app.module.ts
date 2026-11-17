import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_ENV } from './config/tokens';
import { AppEnvironment } from './config/environment';
import { EnvironmentModule } from './config/environment.module';
import { THROTTLE } from './config/throttle';
import { CommonModule } from './common/common.module';
import { HealthController } from './common/health.controller';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    EnvironmentModule,
    CommonModule,
    TypeOrmModule.forRootAsync({
      inject: [APP_ENV],
      useFactory: (environment: AppEnvironment) => ({
        type: 'postgres' as const,
        host: environment.database.host,
        port: environment.database.port,
        username: environment.database.user,
        password: environment.database.password,
        database: environment.database.name,
        autoLoadEntities: true,
        // En desarrollo y pruebas el esquema se sincroniza desde las entidades.
        // En producción se recomienda reemplazar por migraciones versionadas en Git.
        synchronize: environment.nodeEnv !== 'production',
        logging: environment.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: THROTTLE.global.ttl, limit: THROTTLE.global.limit }]),
    UsersModule,
    AuthModule,
    CatalogModule,
    CartModule,
    MembershipsModule,
    OrdersModule,
    PaymentsModule,
    BookingsModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
