import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../lib/session';
import { formatMoney } from '../lib/format';
import { PageHeader } from '../components/AppShell';
import { Badge, Button, Card, EmptyState, ErrorState, Loading } from '../components/ui';

export function CartPage() {
  const { cart, loading, setQuantity, remove, clear } = useCart();
  const { notify } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading && !cart) return <Loading rows={3} />;
  if (!cart) {
    return (
      <ErrorState message="No fue posible leer tu carrito. Recarga la página para intentarlo de nuevo." />
    );
  }

  const run = async (itemId: string, action: () => Promise<void>, success: string) => {
    setBusyId(itemId);
    try {
      await action();
      notify(success, 'success');
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'La acción no se pudo completar', 'danger');
    } finally {
      setBusyId(null);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="stack">
        <PageHeader title="Tu carrito" />
        <EmptyState
          title="El carrito está vacío"
          description="Agrega productos, servicios o una membresía para continuar con la compra."
          action={
            <Link className="btn btn-primary" to="/">
              Explorar el catálogo
            </Link>
          }
        />
      </div>
    );
  }

  const hasUnavailable = cart.items.some((item) => !item.available);

  return (
    <div className="stack">
      <PageHeader
        title="Tu carrito"
        subtitle={`${cart.totals.units} artículo(s) listos para pagar`}
        actions={
          <Button
            variant="secondary"
            disabled={busyId !== null}
            onClick={() => {
              if (!window.confirm('¿Vaciar todo el carrito?')) return;
              void run('clear', async () => {
                await clear();
              }, 'Carrito vacío');
            }}
          >
            Vaciar carrito
          </Button>
        }
      />

      <div className="grid grid-two" style={{ alignItems: 'start' }}>
        <div className="list">
          {cart.items.map((line) => (
            <article key={line.id} className="list-item">
              <div className="stack" style={{ gap: 'var(--space-2)', flex: '1 1 14rem' }}>
                <h3 style={{ margin: 0, fontSize: 'var(--text-md)' }}>
                  <Link to={`/productos/${line.productId}`}>{line.productName}</Link>
                </h3>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <Badge tone="neutral">{line.kind === 'SERVICE' ? 'Servicio' : 'Producto'}</Badge>
                  {!line.available ? <Badge tone="danger">Sin disponibilidad</Badge> : null}
                  <span className="tiny muted">{formatMoney(line.unitPrice)} c/u</span>
                </div>
              </div>

              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Restar una unidad de ${line.productName}`}
                  disabled={busyId === line.id || line.quantity <= 1}
                  onClick={() =>
                    void run(line.id, async () => {
                      await setQuantity(line.id, line.quantity - 1);
                    }, 'Cantidad actualizada')
                  }
                >
                  −
                </Button>
                <span className="badge" aria-live="polite">
                  {line.quantity}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Sumar una unidad de ${line.productName}`}
                  disabled={busyId === line.id || line.quantity >= 99}
                  onClick={() =>
                    void run(line.id, async () => {
                      await setQuantity(line.id, line.quantity + 1);
                    }, 'Cantidad actualizada')
                  }
                >
                  +
                </Button>
              </div>

              <div className="stack" style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                <strong>{formatMoney(line.lineTotal)}</strong>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === line.id}
                  onClick={() =>
                    void run(line.id, async () => {
                      await remove(line.id);
                    }, 'Artículo eliminado')
                  }
                >
                  Quitar
                </Button>
              </div>
            </article>
          ))}
        </div>

        <Card title="Resumen">
          <div className="stack">
            <div className="row-between">
              <span className="muted tiny">Subtotal</span>
              <strong>{formatMoney(cart.totals.subtotal)}</strong>
            </div>
            <div className="row-between">
              <span className="muted tiny">Total</span>
              <span className="price">{formatMoney(cart.totals.total)}</span>
            </div>
            {hasUnavailable ? (
              <p className="tiny" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                Hay artículos sin disponibilidad: quítalos para poder continuar.
              </p>
            ) : null}
            <Link
              className="btn btn-primary btn-block"
              to="/pago"
              aria-disabled={hasUnavailable}
              onClick={(event) => {
                if (hasUnavailable) event.preventDefault();
              }}
            >
              Finalizar compra
            </Link>
            <Link className="btn btn-ghost btn-block" to="/">
              Seguir comprando
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
