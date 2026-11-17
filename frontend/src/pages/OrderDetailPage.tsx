import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../components/AppShell';
import { PaymentForm } from '../components/PaymentForm';
import {
  Alert,
  Badge,
  Card,
  ErrorState,
  LinkButton,
  Loading,
  Money,
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../components/ui';
import { orders, payments } from '../lib/api';
import { formatDateTime, formatMoney } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { useResource } from '../lib/useResource';
import type { Order, Payment, PaymentResult } from '../types/api';

const TYPE_LABELS: Record<Order['type'], string> = {
  CATALOG: 'Productos',
  MEMBERSHIP: 'Membresía',
};

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { notify } = useToast();
  const [attempt, setAttempt] = useState(0);
  const order = useResource(() => orders.byId(id), [id]);
  const receipt = useResource(() => payments.forOrder(id), [id]);

  const reloadBoth = () => {
    order.reload();
    receipt.reload();
  };

  const onPaid = (result: PaymentResult) => {
    const approved = result.payment.status === 'APPROVED';
    notify(approved ? 'Pago aprobado' : 'Pago rechazado', approved ? 'success' : 'danger');
    if (!approved) setAttempt((current) => current + 1);
    reloadBoth();
  };

  if (order.loading) return <Loading rows={5} />;
  if (order.error) return <ErrorState message={order.error} onRetry={reloadBoth} />;
  if (!order.data) return null;

  const data = order.data;
  const payment = receipt.data ?? null;

  return (
    <>
      <PageHeader
        title={`Pedido ${data.code}`}
        subtitle={`Creado el ${formatDateTime(data.createdAt)} · Actualizado el ${formatDateTime(data.updatedAt)}`}
        actions={<LinkButton to="/pedidos" variant="secondary">Volver a mis pedidos</LinkButton>}
      />

      <div className="stack">
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <OrderStatusBadge status={data.status} />
          <Badge>{TYPE_LABELS[data.type]}</Badge>
        </div>

        {data.status === 'PENDING_PAYMENT' ? (
          <Alert tone="info">
            Este pedido todavía no está pagado. Completa el pago para que empecemos a prepararlo.
          </Alert>
        ) : null}

        <Card title="Artículos" tight>
          <ItemsTable order={data} />
        </Card>

        {receipt.error ? <ErrorState message={receipt.error} onRetry={receipt.reload} /> : null}
        {receipt.loading ? <Loading rows={1} /> : null}

        {data.shippingAddress || data.receiverName ? (
          <Card title="Envío" tight>
            <div className="inset stack" style={{ gap: 'var(--space-2)' }}>
              {data.receiverName ? <strong>{data.receiverName}</strong> : null}
              {data.shippingAddress ? (
                <span className="muted tiny">{data.shippingAddress}</span>
              ) : null}
            </div>
          </Card>
        ) : null}

        {payment ? <PaymentCard payment={payment} /> : null}

        {data.status === 'PENDING_PAYMENT' ? (
          <Card title="Pagar con tarjeta">
            <PaymentForm
              orderId={data.id}
              amount={data.total}
              currency={data.currency}
              idempotencyKey={paymentKey(data, attempt)}
              onPaid={onPaid}
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}

/** La pasarela bloquea reintentos con la misma clave: tras un rechazo se numera el intento. */
const paymentKey = (order: Order, attempt: number): string =>
  attempt === 0 ? `web-${order.code}` : `web-${order.code}-${attempt}`;

function ItemsTable({ order }: { order: Order }) {
  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Artículo</th>
              <th scope="col">Cantidad</th>
              <th scope="col">Precio unitario</th>
              <th scope="col">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPrice, order.currency)}</td>
                <td>{formatMoney(item.lineTotal, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-between">
        <span className="muted tiny">Subtotal</span>
        <Money value={order.subtotal} currency={order.currency} />
      </div>
      <div className="row-between">
        <strong>Total</strong>
        <Money value={order.total} currency={order.currency} />
      </div>
    </div>
  );
}

function PaymentCard({ payment }: { payment: Payment }) {
  const failed = payment.status === 'DECLINED' || payment.status === 'ERROR';
  return (
    <Card title="Pago" tight>
      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <PaymentStatusBadge status={payment.status} />
          <Badge>{payment.gateway}</Badge>
          <span className="tiny muted">{formatDateTime(payment.createdAt)}</span>
        </div>
        <dl className="row" style={{ gap: 'var(--space-5)' }}>
          <div className="stat">
            <dt className="stat-label">Referencia</dt>
            <dd style={{ margin: 0 }}>{payment.reference ?? 'Sin referencia'}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Tarjeta</dt>
            <dd style={{ margin: 0 }}>{payment.cardLast4 ? `•••• ${payment.cardLast4}` : 'No registrada'}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Importe</dt>
            <dd style={{ margin: 0 }}>{formatMoney(payment.amount, payment.currency)}</dd>
          </div>
        </dl>
        {failed && payment.failureReason ? <Alert tone="danger">{payment.failureReason}</Alert> : null}
      </div>
    </Card>
  );
}
