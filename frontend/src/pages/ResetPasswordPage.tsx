import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/api';
import { ApiError } from '../lib/session';
import { Alert, Button, Card, Field, Input } from '../components/ui';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token.trim()) {
      setError('Falta el token de recuperación.');
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      setError('La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      await auth.resetPassword(token.trim(), password);
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No fue posible restablecer la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <Card title="Restablece tu contraseña">
        <form className="stack" onSubmit={submit}>
          <Field
            label="Token de recuperación"
            htmlFor="token"
            hint="Llega en el enlace que enviamos al correo. En desarrollo aparece en la consola del backend."
          >
            <Input
              id="token"
              name="token"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>
          <Field label="Nueva contraseña" htmlFor="newPassword">
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Repite la nueva contraseña" htmlFor="confirm">
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" block disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
          <p className="tiny muted">
            <Link to="/recuperar">Solicitar un nuevo enlace</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
