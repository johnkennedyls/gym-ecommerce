import { useState } from 'react';
import { PageHeader } from '../components/AppShell';
import {
  Alert,
  Badge,
  BOOKING_LABELS,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  Pager,
  SkeletonCard,
} from '../components/ui';
import { useToast } from '../context/ToastContext';
import { bookings } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { ApiError } from '../lib/session';
import { useResource } from '../lib/useResource';
import type { Schedule } from '../types/api';

const LIMIT = 10;

const timeOnly = (value: string): string =>
  new Date(value).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

export function ClassesPage() {
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const { data, loading, error, reload } = useResource(
    () => bookings.schedules({ page, limit: LIMIT }),
    [page],
  );
  const { notify } = useToast();

  const book = async (schedule: Schedule) => {
    setBusy(schedule.id);
    setNotice(undefined);
    try {
      await bookings.book(schedule.id);
      notify(`Cupo reservado en ${schedule.title}`, 'success');
      reload();
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'No fue posible reservar la clase';
      setNotice(message);
      notify(message, 'danger');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      <PageHeader
        title="Clases y servicios"
        subtitle="Agenda las clases de los próximos 14 días. Reserva tu cupo con anticipación."
        actions={<LinkButton to="/mis-reservas" variant="secondary">Mis reservas</LinkButton>}
      />

      <div className="stack">
        {notice ? <Alert tone="danger">{notice}</Alert> : null}

        {loading ? (
          <div className="grid grid-two">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : null}

        {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!loading && !error && data && data.items.length === 0 ? (
          <EmptyState
            title="No hay clases en los próximos días"
            description="Cuando el equipo publique horarios, aparecerán en esta pantalla."
            action={<LinkButton to="/">Volver al catálogo</LinkButton>}
          />
        ) : null}

        {!loading && !error && data && data.items.length > 0 ? (
          <>
            <div className="grid grid-two">
              {data.items.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  busy={busy === schedule.id}
                  onBook={() => void book(schedule)}
                />
              ))}
            </div>
            <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} label="clases" />
          </>
        ) : null}
      </div>
    </>
  );
}

function ScheduleCard({
  schedule,
  busy,
  onBook,
}: {
  schedule: Schedule;
  busy: boolean;
  onBook: () => void;
}) {
  const myStatus = schedule.myBooking?.status ?? null;
  const booked = myStatus === 'CONFIRMED';
  const seats = schedule.remaining === 1 ? '1 cupo disponible' : `${schedule.remaining} cupos disponibles`;

  return (
    <Card title={schedule.title} tight>
      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Badge tone="info">{formatDateTime(schedule.startsAt)}</Badge>
          <span className="tiny muted">hasta las {timeOnly(schedule.endsAt)}</span>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          {[schedule.room, schedule.trainer, schedule.service]
            .filter((value): value is string => Boolean(value))
            .join(' · ') || 'Sede e instructor por definir'}
        </p>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Badge tone={schedule.remaining === 0 ? 'danger' : 'neutral'}>
            {schedule.taken}/{schedule.capacity} reservados
          </Badge>
          {!schedule.isActive ? <Badge tone="warning">Clase no disponible</Badge> : null}
          {myStatus ? (
            <Badge tone={booked ? 'success' : 'neutral'}>
              {booked ? 'Reservada' : BOOKING_LABELS[myStatus]}
            </Badge>
          ) : null}
        </div>
        {schedule.isActive && !myStatus ? (
          <span className="tiny muted">
            {schedule.remaining > 0 ? seats : 'Sin cupos disponibles'}
          </span>
        ) : null}
        {myStatus ? (
          <LinkButton to="/mis-reservas" variant="secondary" className="btn-block">
            Ver mi reserva
          </LinkButton>
        ) : (
          <Button
            block
            disabled={!schedule.isActive || schedule.remaining === 0 || busy}
            onClick={onBook}
          >
            {busy ? 'Reservando…' : 'Reservar'}
          </Button>
        )}
      </div>
    </Card>
  );
}
