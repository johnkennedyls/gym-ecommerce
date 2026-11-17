import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../lib/api';
import { ApiError } from '../lib/session';
import { Alert, Button, Card, Field, Input } from '../components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await auth.forgotPassword(email.trim());
      setSent(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No fue posible enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <Card title="Recupera tu contraseña">
        {sent ? (
          <div className="stack">
            <Alert tone="success">
              Si el correo está registrado, recibirás instrucciones para restablecer la contraseña.
            </Alert>
            <p className="tiny muted">
              En el ambiente de desarrollo el enlace se escribe en la consola del backend (el transporte
              de notificaciones es <code>log</code>). Copia la URL con el token y ábrela en{' '}
              <Link to="/restablecer">restablecer contraseña</Link>.
            </p>
            <Link className="btn btn-secondary" to="/login">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <p className="tiny muted">
              Te enviaremos un enlace de recuperación. Por seguridad la respuesta es la misma exista o no
              la cuenta.
            </p>
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
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button type="submit" block disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar instrucciones'}
            </Button>
            <p className="tiny muted">
              <Link to="/login">Recordé mi contraseña</Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
