import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway.port';
import { SandboxPaymentGateway } from './sandbox-payment.gateway';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AppEnvironment } from '../../config/environment';
import { APP_ENV } from '../../config/tokens';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), UsersModule, OrdersModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY,
      inject: [APP_ENV],
      useFactory: (environment: AppEnvironment): PaymentGateway =>
        // El documento no contempla construir una pasarela propia: se integra un proveedor
        // externo. En este entorno se usa el adaptador de pruebas con reglas deterministas.
        new SandboxPaymentGateway(environment.sandboxStrictMode, environment.nodeEnv === 'test' ? 0 : 120),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
