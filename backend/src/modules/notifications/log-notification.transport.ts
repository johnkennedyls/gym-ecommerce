import { Injectable, Logger } from '@nestjs/common';
import { NotificationTransport, OutboundMessage } from './notification-transport.port';

@Injectable()
export class LogNotificationTransport implements NotificationTransport {
  private readonly logger = new Logger('Notifications');

  async send(message: OutboundMessage): Promise<void> {
    this.logger.log(
      JSON.stringify({
        channel: 'email',
        to: message.to,
        subject: message.subject,
        body: message.body,
        sentAt: new Date().toISOString(),
      }),
    );
  }
}
