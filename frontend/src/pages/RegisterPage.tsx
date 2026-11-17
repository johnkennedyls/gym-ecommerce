import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/session';
import { Alert, Button, Card, Field, Input } from '../components/ui';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
    phone: '',
    birthDate: '',
  });
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!PASSWORD_RULE.test(form.password)) {
      setError('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        // La API rechaza campos vacíos no declarados: solo se envían si el usuario los diligenció.
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.birthDate ? { birthDate: form.birthDate } : {}),
      });
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No fue posible crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <Card title="Crea tu cuenta">
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Nombres" htmlFor="firstName" hint="Entre 2 y 60 caracteres.">
              <Input id="firstName" name="given-name" minLength={2} maxLength={60} required autoFocus value={form.firstName} onChange={set('firstName')} />
            </Field>
            <Field label="Apellidos" htmlFor="lastName">
              <Input id="lastName" name="family-name" minLength={2} maxLength={60} required value={form.lastName} onChange={set('lastName')} />
            </Field>
          </div>

          <Field label="Correo electrónico" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" maxLength={160} required value={form.email} onChange={set('email')} />
          </Field>

          <Field
            label="Contraseña"
            htmlFor="password"
            hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              value={form.password}
              onChange={set('password')}
            />
          </Field>

          <Field label="Repite la contraseña" htmlFor="confirm">
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              value={form.confirm}
              onChange={set('confirm')}
            />
          </Field>

          <div className="form-grid">
            <Field label="Teléfono (opcional)" htmlFor="phone">
              <Input id="phone" name="tel" type="tel" maxLength={20} value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Fecha de nacimiento (opcional)" htmlFor="birthDate">
              <Input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={set('birthDate')} />
            </Field>
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button type="submit" block disabled={busy}>
            {busy ? 'Creando cuenta…' : 'Registrarme'}
          </Button>
        </form>

        <p className="tiny muted" style={{ marginTop: 'var(--space-4)' }}>
          Ya tienes cuenta:{' '}
          <Link to="/login">inicia sesión</Link>
        </p>
      </Card>
    </div>
  );
}
