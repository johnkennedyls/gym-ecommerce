import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/session';
import { Alert, Button, Card, Field, Input, LinkButton } from '../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Administrador', email: 'admin@gymsoftware.test', password: 'Admin1234' },
  { label: 'Personal', email: 'staff@gymsoftware.test', password: 'Staff1234' },
  { label: 'Cliente', email: 'cliente@gymsoftware.test', password: 'Cliente1234' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const origin = (location.state as { from?: string } | null)?.from ?? '/';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(email, password);
      navigate(origin, { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No fue posible iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card stack">
      <Card title="Ingresa a tu cuenta">
        <form className="stack" onSubmit={submit}>
          <Field label="Correo electrónico" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" block disabled={busy}>
            {busy ? 'Verificando…' : 'Iniciar sesión'}
          </Button>
        </form>

        <div className="row" style={{ marginTop: 'var(--space-4)' }}>
          <Link to="/registro">Crear una cuenta</Link>
          <span className="muted" aria-hidden="true">
            ·
          </span>
          <Link to="/recuperar">Olvidé mi contraseña</Link>
        </div>
      </Card>

      <Card title="Cuentas de demostración" tight>
        <p className="tiny muted">
          Datos sembrados en la base de desarrollo. Cada rol habilita pantallas distintas.
        </p>
        <ul className="stack" style={{ gap: 'var(--space-2)', paddingLeft: '1.1rem', margin: 0 }}>
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email} className="tiny">
              <strong>{account.label}</strong>: {account.email} / {account.password}{' '}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                Usar
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <p className="tiny muted">
        ¿Solo quieres mirar el catálogo?{' '}
        <LinkButton to="/" variant="secondary" className="btn-sm">
          Ver productos
        </LinkButton>
      </p>
    </div>
  );
}
