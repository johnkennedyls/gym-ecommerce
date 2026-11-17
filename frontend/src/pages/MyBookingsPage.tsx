import { useState } from 'react';
import { PageHeader } from '../components/AppShell';
import {
  Badge,
  BookingStatusBadge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
} from '../components/ui';
import { useToast } from '../context/ToastContext';
import { bookings } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { ApiError } from '../lib/session';
import { useResource } from '../lib/useResource';
import type { BookingSummary } from '../types/api';

export function MyBookingsPage() {
  const [history, setHistory] = useState(false);
  const [cancelling, setCancelling] = useState<string | undefined>(undefined);
  const { data, loading, error, reload } = useResource(() => bookings.mine(history), [history]);
  const { notify } = useToast();

  const cancel = async (booking: BookingSummary) => {
    if (!window.confirm(`¿Cancelar tu reserva de ${booking.title}?`)) return;
    setCancelling(booking.id);
    try {
      const result = await bookings.cancel(booking.id);
      notify(result.message, 'success');
      reload();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible cancelar la reserva', 'danger');
    } finally {
      setCancelling(undefined);
    }
  };

  return (
    <>
      <PageHeader
        title="Mis reservas"
        subtitle={
          history
            ? 'Historial de clases a las que asististe o cancelaste.'
            : 'Tus próximos cupos. Puedes cancelar hasta 2 horas antes de la clase.'
        }
        actions={<LinkButton to="/clases">Reservar otra clase</LinkButton>}
      />

      <div className="stack">
        <div className="row" role="group" aria-label="Filtro de reservas">
          <Button
            variant={history ? 'secondary' : 'primary'}
            size="sm"
            aria-pressed={!history}
            onClick={() => setHistory(false)}
          >
            Próximas
          </Button>
          <Button
            variant={history ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={history}
            onClick={() => setHistory(true)}
          >
            Historial
          </Button>
        </div>

        {loading ? <Loading rows={3} /> : null}

        {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!loading && !error && data && data.length === 0 ? (
          <EmptyState
            title={history ? 'Aún no tienes reservas pasadas' : 'No tienes reservas próximas'}
            description="Reserva una clase o servicio y aparecerá en esta lista."
            action={<LinkButton to="/clases">Ver clases disponibles</LinkButton>}
          />
        ) : null}

        {!loading && !error && data && data.length > 0 ? (
          <div className="list">
            {data.map((booking) => (
              <article className="list-item" key={booking.id}>
                <div className="stack" style={{ gap: 'var(--space-2)', flex: 1 }}>
                  <div className="row" style={{ gap: 'var(--space-2)' }}>
                    <strong>{booking.title}</strong>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <span className="tiny muted">{formatDateTime(booking.startsAt)}</span>
                </div>
                {booking.status === 'CONFIRMED' ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={cancelling === booking.id}
                    onClick={() => void cancel(booking)}
                  >
                    {cancelling === booking.id ? 'Cancelando…' : 'Cancelar reserva'}
                  </Button>
                ) : (
                  <Badge
                    tone={
                      booking.status === 'ATTENDED'
                        ? 'success'
                        : booking.status === 'NO_SHOW'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {booking.status === 'ATTENDED'
                      ? 'Asististe'
                      : booking.status === 'CANCELLED'
                        ? 'Ya cancelaste'
                        : 'No asististe'}
                  </Badge>
                )}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
