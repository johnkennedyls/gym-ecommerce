import { useState } from 'react';
import { PageHeader } from '../components/AppShell';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
} from '../components/ui';
import { useToast } from '../context/ToastContext';
import { notifications } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { ApiError } from '../lib/session';
import { useResource } from '../lib/useResource';
import type { NotificationItem } from '../types/api';

const EVENT_LABELS: Record<string, string> = {
  WELCOME: 'Bienvenida',
  ORDER_CREATED: 'Pedido creado',
  PAYMENT_APPROVED: 'Pago aprobado',
  PAYMENT_DECLINED: 'Pago rechazado',
  ORDER_STATUS_CHANGED: 'Estado del pedido',
  MEMBERSHIP_ACTIVATED: 'Membresía activa',
  MEMBERSHIP_EXPIRING: 'Membresía por vencer',
  BOOKING_CONFIRMED: 'Reserva confirmada',
  BOOKING_CANCELLED: 'Reserva cancelada',
  PASSWORD_RESET: 'Contraseña',
};

export function NotificationsPage() {
  const { data, loading, error, reload, update } = useResource(
    () => notifications.list(50),
    [],
  );
  const { notify } = useToast();
  const [saving, setSaving] = useState<string | undefined>(undefined);

  const markRead = async (item: NotificationItem) => {
    setSaving(item.id);
    try {
      const read = await notifications.markRead(item.id);
      if (data) {
        update({
          items: data.items.map((entry) =>
            entry.id === item.id ? { ...entry, readAt: read.readAt ?? new Date().toISOString() } : entry,
          ),
          unread: Math.max(0, data.unread - 1),
        });
      }
      window.dispatchEvent(new Event('gymsoftware:notifications-changed'));
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible marcar la notificación', 'danger');
    } finally {
      setSaving(undefined);
    }
  };

  const unread = data?.unread ?? 0;

  return (
    <>
      <PageHeader
        title="Notificaciones"
        subtitle={
          data
            ? unread === 0
              ? 'Estás al día: no tienes notificaciones sin leer.'
              : `Tienes ${unread} ${unread === 1 ? 'notificación sin leer' : 'notificaciones sin leer'}.`
            : 'Aquí verás los avisos de tus pedidos, pagos, membresías y clases.'
        }
      />

      {loading ? <Loading rows={5} /> : null}

      {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}

      {!loading && !error && data && data.items.length === 0 ? (
        <EmptyState
          title="No tienes notificaciones"
          description="Te avisaremos cuando cambie el estado de un pedido, un pago o una reserva."
          action={<LinkButton to="/">Ir al catálogo</LinkButton>}
        />
      ) : null}

      {!loading && !error && data && data.items.length > 0 ? (
        <div className="list">
          {data.items.map((item) => (
            <article
              className="list-item"
              key={item.id}
              data-unread={item.readAt ? 'false' : 'true'}
            >
              <div className="stack" style={{ gap: 'var(--space-2)', flex: 1 }}>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <strong>{item.title}</strong>
                  <Badge>{EVENT_LABELS[item.event] ?? item.event}</Badge>
                  {!item.readAt ? <Badge tone="accent">Sin leer</Badge> : null}
                </div>
                <p className="muted tiny" style={{ margin: 0 }}>
                  {item.body}
                </p>
                <span className="tiny muted">{formatDateTime(item.createdAt)}</span>
              </div>
              {item.readAt ? (
                <span className="tiny muted">Leída el {formatDateTime(item.readAt)}</span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving === item.id}
                  onClick={() => void markRead(item)}
                >
                  {saving === item.id ? 'Guardando…' : 'Marcar como leída'}
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
