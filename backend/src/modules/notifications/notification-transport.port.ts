export const NOTIFICATION_TRANSPORT = Symbol('NOTIFICATION_TRANSPORT');

export type OutboundMessage = {
  to: string;
  subject: string;
  body: string;
};

/**
 * Puerto de envío de notificaciones. La implementación de desarrollo registra el
 * mensaje; producciones reales inyectan un adaptador SMTP sin tocar el dominio.
 */
export interface NotificationTransport {
  send(message: OutboundMessage): Promise<void>;
}
