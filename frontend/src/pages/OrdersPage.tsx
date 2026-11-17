import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/AppShell';
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LinkButton,
  Loading,
  Money,
  Option,
  ORDER_LABELS,
  OrderStatusBadge,
  Pager,
  Select,
} from '../components/ui';
import { orders } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useResource } from '../lib/useResource';
import type { Order, OrderStatus } from '../types/api';

const LIMIT = 10;
const STATUSES = Object.keys(ORDER_LABELS) as OrderStatus[];

const TYPE_LABELS: Record<Order['type'], string> = {
  CATALOG: 'Productos',
  MEMBERSHIP: 'Membresía',
};

export function OrdersPage() {
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useResource(
    () => orders.mine({ page, limit: LIMIT, status: status || undefined }),
    [page, status],
  );

  const onFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatus(event.target.value as '' | OrderStatus);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Mis pedidos"
        subtitle="Sigue el estado de tus compras y paga los pedidos que están pendientes."
      />

      <div className="stack">
        <div style={{ maxWidth: '22rem' }}>
          <Field label="Estado del pedido" htmlFor="order-status-filter">
            <Select id="order-status-filter" value={status} onChange={onFilter}>
              <Option value="">Todos los estados</Option>
              {STATUSES.map((code) => (
                <Option key={code} value={code}>
                  {ORDER_LABELS[code]}
                </Option>
              ))}
            </Select>
          </Field>
        </div>

        {loading ? <Loading rows={4} /> : null}

        {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!loading && !error && data && data.items.length === 0 ? (
          <EmptyState
            title="No tenemos pedidos con este filtro"
            description="Explora el catálogo y tu próximo pedido aparecerá aquí."
            action={<LinkButton to="/">Ir al catálogo</LinkButton>}
          />
        ) : null}

        {!loading && !error && data && data.items.length > 0 ? (
          <>
            <div className="list">
              {data.items.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
            <Pager
              page={data.page}
              totalPages={data.totalPages}
              onChange={setPage}
              label="pedidos"
            />
          </>
        ) : null}
      </div>
    </>
  );
}

function OrderRow({ order }: { order: Order }) {
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const pending = order.status === 'PENDING_PAYMENT';

  return (
    <article className="list-item">
      <div className="stack" style={{ gap: 'var(--space-2)', flex: 1 }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Link to={`/pedidos/${order.id}`} style={{ fontWeight: 700 }}>
            {order.code}
          </Link>
          <OrderStatusBadge status={order.status} />
          <Badge>{TYPE_LABELS[order.type]}</Badge>
        </div>
        <span className="tiny muted">
          {formatDateTime(order.createdAt)} · {units} {units === 1 ? 'unidad' : 'unidades'}
        </span>
      </div>

      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <Money value={order.total} currency={order.currency} />
        {pending ? (
          <LinkButton to={`/pedidos/${order.id}`}>Pagar ahora</LinkButton>
        ) : (
          <LinkButton to={`/pedidos/${order.id}`} variant="secondary">
            Ver detalle
          </LinkButton>
        )}
      </div>
    </article>
  );
}
