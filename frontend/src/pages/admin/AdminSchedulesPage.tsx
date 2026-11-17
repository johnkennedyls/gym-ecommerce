import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { PageHeader } from '../../components/AppShell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Option,
  Pager,
  Select,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { bookings, catalog, type ScheduleInput } from '../../lib/api';
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from '../../lib/format';
import { ApiError } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import type { Schedule } from '../../types/api';

type Choice = { value: string; label: string };

function Table({ head, rows }: { head: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  const headers = head.map((title) => (
    <th key={title} scope="col">
      {title}
    </th>
  ));
  const body = rows.map((row) => (
    <tr key={row.key}>
      {row.cells.map((cell, index) => (
        <td key={index}>{cell}</td>
      ))}
    </tr>
  ));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
};

function TextField({ id, label, value, onChange, error, hint, ...rest }: TextProps) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
    </Field>
  );
}

function ChoiceField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange'> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Choice[];
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} {...rest}>
        {options.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </Select>
    </Field>
  );
}

const dash = (value: string | null) => value ?? '—';
const occupied = (schedule: Schedule) => `${schedule.taken}/${schedule.capacity}`;
const remainingBadge = (schedule: Schedule) => (
  <Badge tone={schedule.remaining > 0 ? 'success' : 'danger'}>{schedule.remaining}</Badge>
);
const activeBadge = (schedule: Schedule) => (
  <Badge tone={schedule.isActive ? 'success' : 'neutral'}>{schedule.isActive ? 'Activo' : 'Inactivo'}</Badge>
);

type FormState = {
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  room: string;
  productId: string;
  isActive: boolean;
};

type Errors = Partial<Record<keyof FormState, string>>;

const defaultTimes = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return { startsAt: toDateTimeLocal(start), endsAt: toDateTimeLocal(new Date(start.getTime() + 3_600_000)) };
};

const emptyForm = (): FormState => ({
  title: '', ...defaultTimes(), capacity: '12', room: '', productId: '', isActive: true,
});

const toFormState = (schedule: Schedule): FormState => ({
  title: schedule.title,
  startsAt: toDateTimeLocal(schedule.startsAt),
  endsAt: toDateTimeLocal(schedule.endsAt),
  capacity: String(schedule.capacity),
  room: schedule.room ?? '',
  productId: '',
  isActive: schedule.isActive,
});

function validate(form: FormState): Errors {
  const errors: Errors = {};
  const title = form.title.trim();
  if (title.length < 3 || title.length > 120) errors.title = 'El título debe tener entre 3 y 120 caracteres.';
  const startsAt = new Date(form.startsAt);
  const endsAt = new Date(form.endsAt);
  if (form.startsAt === '' || Number.isNaN(startsAt.getTime())) errors.startsAt = 'Selecciona el inicio del horario.';
  if (form.endsAt === '' || Number.isNaN(endsAt.getTime())) errors.endsAt = 'Selecciona la finalización del horario.';
  else if (form.startsAt !== '' && endsAt.getTime() <= startsAt.getTime())
    errors.endsAt = 'La fecha de fin debe ser posterior a la de inicio.';
  const capacity = Number(form.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200)
    errors.capacity = 'El cupo debe ser un entero entre 1 y 200.';
  if (form.room.trim().length > 60) errors.room = 'El salón admite máximo 60 caracteres.';
  return errors;
}

export function AdminSchedulesPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const list = useResource(() => bookings.schedules({ page, limit: 10, includeInactive: true }), [page]);
  const services = useResource(() => catalog.products({ limit: 100, kind: 'SERVICE' }), []);

  const serviceOptions: Choice[] = [
    { value: '', label: 'Sin servicio' },
    ...(services.data?.items ?? []).map((service) => ({ value: service.id, label: service.name })),
  ];

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const openForm = (schedule: Schedule | null) => {
    setEditing(schedule);
    setForm(schedule ? toFormState(schedule) : emptyForm());
    setErrors({});
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const startsAt = fromDateTimeLocal(form.startsAt);
    const endsAt = fromDateTimeLocal(form.endsAt);
    const title = form.title.trim();
    const capacity = Number(form.capacity);
    const room = form.room.trim();
    setSaving(true);
    try {
      if (editing) {
        const changes: Partial<ScheduleInput> = { title, startsAt, endsAt, capacity, isActive: form.isActive };
        if (room !== '') changes.room = room;
        if (form.productId !== '') changes.productId = form.productId;
        await bookings.updateSchedule(editing.id, changes);
        notify('Horario actualizado.', 'success');
      } else {
        const body: ScheduleInput = { title, startsAt, endsAt, capacity, isActive: form.isActive };
        if (room !== '') body.room = room;
        if (form.productId !== '') body.productId = form.productId;
        await bookings.createSchedule(body);
        notify('Horario creado.', 'success');
      }
      setOpen(false);
      list.reload();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible guardar el horario.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const rowActions = (schedule: Schedule) => (
    <Button size="sm" variant="secondary" onClick={() => openForm(schedule)}>
      Editar
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Horarios de clases"
        subtitle="RF-11 · Sesiones grupales y servicios con cupo; incluye los horarios inactivos."
        actions={<Button onClick={() => openForm(null)}>Nuevo horario</Button>}
      />

      <Card>
        {list.loading ? <Loading rows={5} /> : null}
        {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
        {list.data && list.data.items.length === 0 ? (
          <EmptyState
            title="Sin horarios publicados"
            description="Crea el primer horario para que los clientes puedan reservar."
            action={<Button onClick={() => openForm(null)}>Nuevo horario</Button>}
          />
        ) : null}
        {list.data && list.data.items.length > 0 ? (
          <>
            <Table
              head={['Título', 'Inicio', 'Fin', 'Salón', 'Entrenador', 'Servicio', 'Ocupación', 'Libres', 'Estado', 'Acción']}
              rows={list.data.items.map((schedule) => ({
                key: schedule.id,
                cells: [
                  schedule.title,
                  formatDateTime(schedule.startsAt),
                  formatDateTime(schedule.endsAt),
                  dash(schedule.room),
                  schedule.trainer ?? 'Sin asignar',
                  dash(schedule.service),
                  occupied(schedule),
                  remainingBadge(schedule),
                  activeBadge(schedule),
                  rowActions(schedule),
                ],
              }))}
            />
            <Pager page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} label="horarios" />
          </>
        ) : null}
      </Card>

      {open ? (
        <Modal title={editing ? `Editar ${editing.title}` : 'Nuevo horario'} onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={submit}>
            <TextField
              id="s-title"
              label="Título"
              value={form.title}
              maxLength={120}
              required
              placeholder="Funcional 60 · sábado"
              error={errors.title}
              hint="Entre 3 y 120 caracteres."
              onChange={(value) => set({ title: value })}
            />
            <div className="form-grid">
              <TextField id="s-start" label="Inicio" type="datetime-local" value={form.startsAt} required error={errors.startsAt} onChange={(value) => set({ startsAt: value })} />
              <TextField id="s-end" label="Fin" type="datetime-local" value={form.endsAt} required error={errors.endsAt} hint="La API rechaza un fin igual o anterior al inicio." onChange={(value) => set({ endsAt: value })} />
              <TextField id="s-capacity" label="Cupo máximo" type="number" min={1} max={200} step={1} value={form.capacity} required error={errors.capacity} hint="Entre 1 y 200 personas." onChange={(value) => set({ capacity: value })} />
              <TextField id="s-room" label="Salón" value={form.room} maxLength={60} error={errors.room} hint="Opcional, máximo 60 caracteres." onChange={(value) => set({ room: value })} />
              <ChoiceField id="s-product" label="Servicio vinculado" value={form.productId} options={serviceOptions} hint="Se envía solo si seleccionas uno; el entrenador se asigna desde el backend." onChange={(value) => set({ productId: value })} />
            </div>
            <label className="checkbox" htmlFor="s-active">
              <input
                id="s-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => set({ isActive: event.target.checked })}
              />
              Horario abierto para reserva
            </label>
            <div className="row">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear horario'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
