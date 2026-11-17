import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { orders } from '../lib/api';
import type { Order, PaymentResult } from '../types/api';
import { formatMoney } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../lib/session';
import { PageHeader } from '../components/AppShell';
import { PaymentForm } from '../components/PaymentForm';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Textarea,
} from '../components/ui';

export function CheckoutPage() {
  const { user } = useAuth();
  const { cart, loading, reload } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [declined, setDeclined] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (loading && !cart) return <Loading rows={2} />;

  if (!order && cart && cart.items.length === 0) {
    return (
      <div className="stack">
        <PageHeader title="Pago" />
        <EmptyState
          title="No hay nada que pagar"
          description="Agrega artículos al carrito antes de continuar."
          action={
            <Link className="btn btn-primary" to="/">
              Ver catálogo
            </Link>
          }
        />
      </div>
    );
  }

  const createOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      const created = await orders.checkout(
        (data.get('shippingAddress') as string).trim(),
        (data.get('receiverName') as string).trim(),
      );
      setOrder(created);
      await reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No fue posible crear el pedido.');
    } finally {
      setBusy(false);
    }
  };

  const onPaid = async (result: PaymentResult) => {
    // Una clave nueva por intento: el backend rechaza reintentos que reutilizan la clave.
    setAttempt((value) => value + 1);
    if (result.payment.status === 'APPROVED') {
      notify('Pago aprobado: tu pedido quedó confirmado', 'success');
      await reload();
      navigate(`/pedidos/${result.order.id}`, { replace: true });
      return;
    }
    setDeclined(
      result.payment.failureReason ??
        'La pasarela rechazó la tarjeta. Revisa los datos o intenta con otra tarjeta.',
    );
    notify('El pago no fue aprobado', 'danger');
  };

  return (
    <div className="stack">
      <PageHeader
        title={order ? `Pago del pedido ${order.code}` : 'Confirmar compra'}
        subtitle={
          order
            ? 'Completa los datos de la tarjeta para aprobar la transacción.'
            : 'Revisa los datos de entrega y luego paga con la pasarela de pruebas.'
        }
        actions={
          <Link className="btn btn-ghost" to="/carrito">
            ← Volver al carrito
          </Link>
        }
      />

      <div className="grid grid-two" style={{ alignItems: 'start' }}>
        <div className="stack">
          {!order ? (
            <Card title="Datos de entrega">
              <form className="stack" onSubmit={createOrder}>
                <Field label="Nombre de quien recibe" htmlFor="receiverName" hint="Entre 3 y 140 caracteres.">
                  <Input
                    id="receiverName"
                    name="receiverName"
                    minLength={3}
                    maxLength={140}
                    required
                    autoFocus
                    defaultValue={user ? `${user.firstName} ${user.lastName}` : ''}
                  />
                </Field>
                <Field
                  label="Dirección de entrega o punto de recolección"
                  htmlFor="shippingAddress"
                  hint="Entre 6 y 240 caracteres. Los servicios del gimnasio se recogen en recepción."
                >
                  <Textarea
                    id="shippingAddress"
                    name="shippingAddress"
                    minLength={6}
                    maxLength={240}
                    required
                    defaultValue="Calle 1 #2-3, Popayán"
                  />
                </Field>
                {error ? <Alert tone="danger">{error}</Alert> : null}
                <Button type="submit" disabled={busy}>
                  {busy ? 'Creando pedido…' : 'Continuar al pago'}
                </Button>
              </form>
            </Card>
          ) : (
            <Card title="Tarjeta">
              {declined ? <Alert tone="danger">{declined}</Alert> : null}
              <PaymentForm
                orderId={order.id}
                amount={order.total}
                currency={order.currency}
                idempotencyKey={`web-${order.code}-${attempt}`}
                onPaid={onPaid}
              />
            </Card>
          )}
        </div>

        <Card title="Resumen del pedido">
          {cart && cart.items.length > 0 ? (
            <div className="stack">
              <ul className="stack" style={{ gap: 'var(--space-2)', paddingLeft: '1.1rem', margin: 0 }}>
                {cart.items.map((line) => (
                  <li key={line.id} className="tiny">
                    {line.quantity} × {line.productName} — {formatMoney(line.lineTotal)}
                  </li>
                ))}
              </ul>
              <div className="row-between">
                <span className="muted tiny">Total</span>
                <span className="price">{formatMoney(cart.totals.total)}</span>
              </div>
            </div>
          ) : (
            <div className="stack">
              <p className="tiny muted">
                El carrito quedó vacío al generar el pedido. Este es el total que se cobrará:
              </p>
              <div className="row-between">
                <span className="muted tiny">Total del pedido {order?.code}</span>
                <span className="price">{formatMoney(order?.total ?? 0)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
