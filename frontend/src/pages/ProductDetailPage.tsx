import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalog } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useResource } from '../lib/useResource';
import { ApiError } from '../lib/session';
import { PageHeader } from '../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Loading,
  Option,
  Select,
} from '../components/ui';

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { isAuthenticated } = useAuth();
  const { add } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const product = useResource(() => catalog.product(id), [id]);

  if (product.loading) return <Loading rows={2} />;
  if (product.error || !product.data) {
    return (
      <ErrorState
        message={product.error ?? 'No encontramos este artículo.'}
        onRetry={product.reload}
      />
    );
  }

  const item = product.data;
  const maxStock = item.stock ?? 99;

  const addToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/productos/${item.id}` } });
      return;
    }
    setBusy(true);
    try {
      await add(item.id, quantity);
      notify(`${quantity} × ${item.name} en el carrito`, 'success');
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible agregar el artículo', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title={item.name}
        subtitle={`${item.category.name} · SKU ${item.sku}`}
        actions={
          <Link className="btn btn-ghost" to="/">
            ← Volver al catálogo
          </Link>
        }
      />

      <div className="grid grid-two" style={{ alignItems: 'start' }}>
        <div className="thumb thumb-lg" aria-hidden="true">
          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.kind === 'SERVICE' ? '🏋️' : '📦'}
        </div>

        <div className="stack">
          <div className="row">
            <Badge tone="neutral">{item.kind === 'SERVICE' ? 'Servicio' : 'Producto'}</Badge>
            <Badge tone={item.available ? 'success' : 'danger'}>
              {item.available ? 'Disponible' : 'Agotado'}
            </Badge>
            {item.kind === 'SERVICE' && item.durationMinutes ? (
              <Badge tone="info">{item.durationMinutes} minutos</Badge>
            ) : null}
            {item.kind === 'PRODUCT' && item.stock !== null ? (
              <Badge tone={item.stock > 5 ? 'accent' : 'warning'}>
                {item.stock <= 5 ? `Quedan ${item.stock}` : `${item.stock} en stock`}
              </Badge>
            ) : null}
          </div>

          <p className="price" style={{ fontSize: 'var(--text-2xl)' }}>
            {formatMoney(item.price, item.currency)}
          </p>

          <p className="muted">{item.description ?? 'Este artículo no tiene descripción registrada.'}</p>

          {!item.available ? (
            <Alert tone="danger">
              No hay unidades disponibles. Puedes buscar otra categoría o revisar las membresías.
            </Alert>
          ) : null}

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Cantidad" htmlFor="quantity">
              <Select
                id="quantity"
                value={String(quantity)}
                onChange={(event) => setQuantity(Number(event.target.value))}
                style={{ width: '7rem' }}
              >
                {Array.from({ length: Math.min(10, Math.max(1, maxStock)) }, (_, index) => index + 1).map(
                  (value) => (
                    <Option key={value} value={String(value)}>
                      {value}
                    </Option>
                  ),
                )}
              </Select>
            </Field>
            <Button onClick={addToCart} disabled={busy || !item.available}>
              {busy ? 'Agregando…' : 'Agregar al carrito'}
            </Button>
            {!isAuthenticated ? <span className="tiny muted">Te pediremos iniciar sesión.</span> : null}
          </div>

          <Card tight title="¿Por qué comprar aquí?">
            <ul className="tiny muted" style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li>Pago procesado en ambiente de pruebas, sin cargos reales.</li>
              <li>Historial y estado de tu pedido siempre visibles en “Mis pedidos”.</li>
              <li>Confirmaciones y avisos en tu bandeja de notificaciones.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
