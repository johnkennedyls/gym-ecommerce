import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { LogNotificationTransport } from './log-notification.transport';
import { NOTIFICATION_TRANSPORT } from './notification-transport.port';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, { provide: NOTIFICATION_TRANSPORT, useClass: LogNotificationTransport }],
  exports: [NotificationsService],
})
export class NotificationsModule {}
