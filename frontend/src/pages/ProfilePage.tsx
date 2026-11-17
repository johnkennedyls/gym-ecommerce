import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/AppShell';
import { Alert, Badge, Button, Card, Field, Input, Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { auth, users } from '../lib/api';
import { ApiError } from '../lib/session';
import type { PublicUser, Role } from '../types/api';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
const DATE_RULE = /^\d{4}-\d{2}-\d{2}$/;

const ROLE_LABELS: Record<Role, { label: string; tone: 'neutral' | 'info' | 'accent' }> = {
  CLIENT: { label: 'CLIENT', tone: 'neutral' },
  STAFF: { label: 'STAFF', tone: 'info' },
  ADMIN: { label: 'ADMIN', tone: 'accent' },
};

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return <Loading rows={4} />;

  return (
    <>
      <PageHeader
        title="Mi perfil"
        subtitle="Actualiza tus datos personales y cambia tu contraseña cuando lo necesites."
      />
      <div className="grid grid-two">
        <ProfileForm user={user} />
        <PasswordForm />
      </div>
    </>
  );
}

type Errors = Partial<Record<'firstName' | 'lastName' | 'phone' | 'birthDate', string>>;

function ProfileForm({ user }: { user: PublicUser }) {
  const { patchUser } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? '',
    birthDate: user.birthDate ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    for (const key of ['firstName', 'lastName'] as const) {
      const value = form[key].trim();
      if (value.length < 2 || value.length > 60) next[key] = 'Debe tener entre 2 y 60 caracteres.';
    }
    if (form.phone.trim().length > 20) next.phone = 'El teléfono admite máximo 20 caracteres.';
    if (form.birthDate && !DATE_RULE.test(form.birthDate)) next.birthDate = 'Usa el formato AAAA-MM-DD.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const updated = await users.updateMe({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.birthDate ? { birthDate: form.birthDate } : {}),
      });
      patchUser(updated);
      notify('Perfil actualizado', 'success');
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible guardar tus datos', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const role = ROLE_LABELS[user.role] ?? { label: user.role, tone: 'neutral' as const };

  return (
    <Card title="Datos personales">
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Badge tone={role.tone}>{role.label}</Badge>
          <span className="tiny muted">{user.isActive ? 'Cuenta activa' : 'Cuenta inactiva'}</span>
        </div>

        <div className="form-grid">
          <Field label="Nombres" htmlFor="firstName" error={errors.firstName}>
            <Input id="firstName" value={form.firstName} onChange={set('firstName')} maxLength={60} required />
          </Field>
          <Field label="Apellidos" htmlFor="lastName" error={errors.lastName}>
            <Input id="lastName" value={form.lastName} onChange={set('lastName')} maxLength={60} required />
          </Field>
          <Field label="Teléfono" htmlFor="phone" hint="Opcional." error={errors.phone}>
            <Input id="phone" value={form.phone} onChange={set('phone')} maxLength={20} inputMode="tel" />
          </Field>
          <Field label="Fecha de nacimiento" htmlFor="birthDate" hint="Opcional." error={errors.birthDate}>
            <Input id="birthDate" type="date" value={form.birthDate} onChange={set('birthDate')} />
          </Field>
        </div>

        <Field label="Correo electrónico" htmlFor="profile-email" hint="Tu correo no se puede cambiar desde aquí.">
          <Input id="profile-email" type="email" value={user.email} readOnly />
        </Field>

        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { logout } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.current) return setError('Escribe tu contraseña actual.');
    if (!PASSWORD_RULE.test(form.next)) {
      return setError('La nueva contraseña debe tener entre 8 y 72 caracteres, con mayúsculas, minúsculas y un número.');
    }
    if (form.next !== form.confirm) return setError('Las contraseñas nuevas no coinciden.');

    setBusy(true);
    setError(undefined);
    try {
      await auth.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      notify('Contraseña actualizada, inicia sesión nuevamente', 'success');
      await logout();
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No fue posible cambiar la contraseña');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Seguridad">
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <Field label="Contraseña actual" htmlFor="currentPassword">
          <Input id="currentPassword" type="password" autoComplete="current-password" maxLength={72} required value={form.current} onChange={set('current')} />
        </Field>
        <Field
          label="Nueva contraseña"
          htmlFor="newPassword"
          hint="Entre 8 y 72 caracteres, con mayúsculas, minúsculas y al menos un número."
        >
          <Input id="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={form.next} onChange={set('next')} />
        </Field>
        <Field label="Confirmar nueva contraseña" htmlFor="confirmPassword">
          <Input id="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={form.confirm} onChange={set('confirm')} />
        </Field>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Alert tone="info">Al cambiar la contraseña se cerrarán todas tus sesiones abiertas.</Alert>

        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? 'Actualizando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </Card>
  );
}
