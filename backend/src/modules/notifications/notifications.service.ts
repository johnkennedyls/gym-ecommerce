import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationEvent } from '../../common/enums';
import { NOTIFICATION_TRANSPORT, NotificationTransport } from './notification-transport.port';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly repository: Repository<Notification>,
    private readonly usersService: UsersService,
    @Inject(NOTIFICATION_TRANSPORT) private readonly transport: NotificationTransport,
  ) {}

  /** RF-15 Notifica un evento relevante y deja evidencia de la entrega. */
  async notify(
    userId: string,
    event: NotificationEvent,
    title: string,
    body: string,
  ): Promise<Notification> {
    const user = await this.usersService.findById(userId);
    const notification = await this.repository.save(
      this.repository.create({ userId, event, title, body, channel: 'email', deliveryStatus: 'PENDING' }),
    );

    try {
      await this.transport.send({ to: user.email, subject: `${title}`, body });
      notification.deliveryStatus = 'SENT';
    } catch {
      notification.deliveryStatus = 'FAILED';
    }
    return this.repository.save(notification);
  }

  listForUser(userId: string, limit = 30): Promise<Notification[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
    });
  }

  unreadCount(userId: string): Promise<number> {
    return this.repository.count({ where: { userId, readAt: IsNull() } });
  }

  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.repository.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('La notificación no existe');
    notification.readAt = new Date();
    return this.repository.save(notification);
  }
}
