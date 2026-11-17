import { useState } from 'react';
import { PageHeader } from '../../components/AppShell';
import {
  Alert,
  BOOKING_LABELS,
  BookingStatusBadge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Option,
  Pager,
  Select,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { bookings } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { ApiError } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import type { BookingRow, BookingStatus } from '../../types/api';

const STATUS_KEYS = Object.keys(BOOKING_LABELS) as BookingStatus[];

export function AdminBookingsPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | BookingStatus>('');
  const [busy, setBusy] = useState('');

  const { data, loading, error, reload } = useResource(
    () => bookings.all({ page, limit: 15, status: status === '' ? undefined : status }),
    [page, status],
  );

  const mark = async (booking: BookingRow, next: BookingStatus) => {
    setBusy(booking.id);
    try {
      await bookings.setAttendance(booking.id, next);
      notify(`Asistencia registrada: ${BOOKING_LABELS[next].toLowerCase()}.`, 'success');
      reload();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible registrar la asistencia.', 'danger');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title="Reservas y asistencia"
        subtitle="RF-11 · Control de asistencia a las clases reservadas por los clientes."
      />

      <Alert tone="info">
        Solo se registran asistencia e inasistencia. La cancelación de una reserva la hace el cliente desde
        «Mis reservas»: el endpoint de asistencia rechaza el estado CANCELLED.
      </Alert>

      <Card tight>
        <div className="row">
          <Field label="Estado" htmlFor="b-status">
            <Select
              id="b-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | BookingStatus);
                setPage(1);
              }}
            >
              <Option value="">Todos</Option>
              {STATUS_KEYS.map((key) => (
                <Option key={key} value={key}>
                  {BOOKING_LABELS[key]}
                </Option>
              ))}
            </Select>
          </Field>
          <Button
            variant="ghost"
            onClick={() => {
              setStatus('');
              setPage(1);
            }}
          >
            Limpiar filtro
          </Button>
        </div>
      </Card>

      <Card>
        {loading ? <Loading rows={5} /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data && data.items.length === 0 ? (
          <EmptyState
            title="Sin reservas"
            description="No hay reservas con el estado seleccionado para la página actual."
          />
        ) : null}
        {data && data.items.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Estudiante</th>
                    <th scope="col">Actividad</th>
                    <th scope="col">Inicio</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.student}</td>
                      <td>{booking.title}</td>
                      <td>{formatDateTime(booking.startsAt)}</td>
                      <td>
                        <BookingStatusBadge status={booking.status} />
                      </td>
                      <td>
                        {booking.status === 'CONFIRMED' ? (
                          <div className="row">
                            <Button
                              size="sm"
                              disabled={busy === booking.id}
                              onClick={() => void mark(booking, 'ATTENDED')}
                            >
                              {busy === booking.id ? 'Guardando…' : 'Asistió'}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy === booking.id}
                              onClick={() => void mark(booking, 'NO_SHOW')}
                            >
                              No asistió
                            </Button>
                          </div>
                        ) : (
                          <span className="tiny muted">No requiere registro de asistencia</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} label="reservas" />
          </>
        ) : null}
      </Card>
    </div>
  );
}
