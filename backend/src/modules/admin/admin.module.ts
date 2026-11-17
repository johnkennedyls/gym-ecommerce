import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ReportsService } from './reports.service';
import { OrdersModule } from '../orders/orders.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { BookingsModule } from '../bookings/bookings.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [OrdersModule, MembershipsModule, BookingsModule, CatalogModule, UsersModule],
  controllers: [AdminController],
  providers: [ReportsService],
})
export class AdminModule {}
