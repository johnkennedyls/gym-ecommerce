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
  Select,
  Textarea,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { memberships, type PlanInput } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { ApiError } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import type { MembershipLevel, Plan } from '../../types/api';

const LEVELS: MembershipLevel[] = ['BASIC', 'PREMIUM', 'ATHLETE'];
const LEVEL_LABELS: Record<MembershipLevel, string> = { BASIC: 'Básico', PREMIUM: 'Premium', ATHLETE: 'Atleta' };
const LEVEL_OPTIONS = LEVELS.map((level) => ({ value: level, label: LEVEL_LABELS[level] }));

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

const priceCell = (plan: Plan) => formatMoney(plan.price, plan.currency);
const levelBadge = (plan: Plan) => <Badge tone="accent">{LEVEL_LABELS[plan.accessLevel]}</Badge>;
const classesBadge = (plan: Plan) => (
  <Badge tone={plan.includesClasses ? 'success' : 'neutral'}>{plan.includesClasses ? 'Incluye' : 'No incluye'}</Badge>
);
const stateBadge = (plan: Plan) => (
  <Badge tone={plan.isActive ? 'success' : 'danger'}>{plan.isActive ? 'Activo' : 'Inactivo'}</Badge>
);
const editAction = (plan: Plan, onEdit: (plan: Plan) => void) => (
  <Button size="sm" variant="secondary" onClick={() => onEdit(plan)}>
    Editar
  </Button>
);

type FormState = {
  name: string;
  description: string;
  price: string;
  durationDays: string;
  accessLevel: MembershipLevel;
  includesClasses: boolean;
  isActive: boolean;
};

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: '', description: '', price: '', durationDays: '30', accessLevel: 'BASIC', includesClasses: false, isActive: true,
};

const toFormState = (plan: Plan): FormState => ({
  name: plan.name,
  description: plan.description ?? '',
  price: String(plan.price),
  durationDays: String(plan.durationDays),
  accessLevel: plan.accessLevel,
  includesClasses: plan.includesClasses,
  isActive: plan.isActive,
});

function validate(form: FormState): Errors {
  const errors: Errors = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 80) errors.name = 'El nombre debe tener entre 2 y 80 caracteres.';
  if (form.description.trim().length > 1000) errors.description = 'La descripción admite máximo 1000 caracteres.';
  const price = Number(form.price);
  if (form.price.trim() === '' || !Number.isFinite(price) || price < 0) errors.price = 'Ingresa un precio mayor o igual a 0.';
  else if (Math.round(price * 100) !== price * 100) errors.price = 'El precio admite máximo 2 decimales.';
  const days = Number(form.durationDays);
  if (!Number.isInteger(days) || days < 1 || days > 730)
    errors.durationDays = 'La vigencia debe ser un entero entre 1 y 730 días.';
  return errors;
}

export function AdminPlansPage() {
  const { notify } = useToast();
  const { data, loading, error, reload } = useResource(() => memberships.adminPlans(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const openForm = (plan: Plan | null) => {
    setEditing(plan);
    setForm(plan ? toFormState(plan) : EMPTY_FORM);
    setErrors({});
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const description = form.description.trim();
    setSaving(true);
    try {
      if (editing) {
        const changes: Partial<PlanInput> = {};
        if (form.name.trim() !== editing.name) changes.name = form.name.trim();
        if (description !== (editing.description ?? '')) changes.description = description;
        if (Number(form.price) !== editing.price) changes.price = Number(form.price);
        if (Number(form.durationDays) !== editing.durationDays) changes.durationDays = Number(form.durationDays);
        if (form.accessLevel !== editing.accessLevel) changes.accessLevel = form.accessLevel;
        if (form.includesClasses !== editing.includesClasses) changes.includesClasses = form.includesClasses;
        if (form.isActive !== editing.isActive) changes.isActive = form.isActive;
        if (Object.keys(changes).length === 0) {
          notify('No hay cambios que guardar.', 'neutral');
          return;
        }
        await memberships.updatePlan(editing.id, changes);
        notify('Plan actualizado.', 'success');
      } else {
        const body: PlanInput = {
          name: form.name.trim(),
          price: Number(form.price),
          durationDays: Number(form.durationDays),
          accessLevel: form.accessLevel,
          includesClasses: form.includesClasses,
          isActive: form.isActive,
        };
        if (description !== '') body.description = description;
        await memberships.createPlan(body);
        notify('Plan creado.', 'success');
      }
      setOpen(false);
      reload();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible guardar el plan.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title="Planes de membresía"
        subtitle="RF-10 y RF-12 · Vigencias, niveles de acceso y clases incluidas."
        actions={<Button onClick={() => openForm(null)}>Nuevo plan</Button>}
      />

      <Card>
        {loading ? <Loading rows={4} /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data && data.length === 0 ? (
          <EmptyState
            title="Sin planes"
            description="Crea el primer plan para que los clientes puedan comprar membresías."
            action={<Button onClick={() => openForm(null)}>Nuevo plan</Button>}
          />
        ) : null}
        {data && data.length > 0 ? (
          <Table
            head={['Plan', 'Precio', 'Vigencia', 'Nivel', 'Clases', 'Estado', 'Acción']}
            rows={data.map((plan) => ({
              key: plan.id,
              cells: [
                plan.name,
                priceCell(plan),
                `${plan.durationDays} días`,
                levelBadge(plan),
                classesBadge(plan),
                stateBadge(plan),
                editAction(plan, openForm),
              ],
            }))}
          />
        ) : null}
      </Card>

      {open ? (
        <Modal title={editing ? `Editar ${editing.name}` : 'Nuevo plan'} onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={submit}>
            <div className="form-grid">
              <TextField id="plan-name" label="Nombre" value={form.name} maxLength={80} required error={errors.name} onChange={(value) => set({ name: value })} />
              <TextField id="plan-price" label="Precio (COP)" type="number" min={0} step="0.01" value={form.price} required error={errors.price} onChange={(value) => set({ price: value })} />
              <TextField id="plan-days" label="Vigencia (días)" type="number" min={1} max={730} step={1} value={form.durationDays} required error={errors.durationDays} hint="Entre 1 y 730." onChange={(value) => set({ durationDays: value })} />
              <ChoiceField id="plan-level" label="Nivel de acceso" value={form.accessLevel} options={LEVEL_OPTIONS} onChange={(value) => set({ accessLevel: value as MembershipLevel })} />
            </div>
            <Field label="Descripción" htmlFor="plan-description" error={errors.description} hint="Opcional, máximo 1000 caracteres.">
              <Textarea id="plan-description" rows={3} value={form.description} maxLength={1000} onChange={(event) => set({ description: event.target.value })} />
            </Field>
            <label className="checkbox" htmlFor="plan-classes">
              <input id="plan-classes" type="checkbox" checked={form.includesClasses} onChange={(event) => set({ includesClasses: event.target.checked })} />
              Incluye reserva de clases grupales
            </label>
            <label className="checkbox" htmlFor="plan-active">
              <input id="plan-active" type="checkbox" checked={form.isActive} onChange={(event) => set({ isActive: event.target.checked })} />
              Plan disponible para compra
            </label>
            <div className="row">
              <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear plan'}</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
