import { useState, type FormEvent, type ReactNode } from 'react';
import { PageHeader } from '../../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Option,
  ORDER_LABELS,
  OrderStatusBadge,
  Pager,
  Select,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { orders } from '../../lib/api';
import { formatDateTime, formatMoney } from '../../lib/format';
import { ApiError } from '../../lib/session';
import { useResource } from '../../lib/useResource';
import type { Order, OrderStatus } from '../../types/api';

/** Copia de TRANSITIONS en orders.service.ts: la API rechaza cualquier otro salto. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'COMPLETED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

const ORDER_KEYS = Object.keys(ORDER_LABELS) as OrderStatus[];
const STATUS_OPTIONS = ORDER_KEYS.map((status) => ({ value: status, label: ORDER_LABELS[status] }));

function Table({ head, rows }: { head: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  const headers = head.map((title) => (
    <th key={title} scope="col">
      {title}
    </th>
  ));
  const body = rows.map((row) => (
    <tr key={row.key}>
      {row.cells.map((cell, index) => (
        <td key={index}>{cell}</td>
      ))}
    </tr>
  ));
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}

const typeBadge = (order: Order) => (
  <Badge tone={order.type === 'MEMBERSHIP' ? 'accent' : 'info'}>{order.type === 'MEMBERSHIP' ? 'Membresía' : 'Catálogo'}</Badge>
);
const manageAction = (order: Order, onManage: (order: Order) => void) => (
  <Button size="sm" variant="secondary" onClick={() => onManage(order)}>
    Gestionar
  </Button>
);

function ManageDialog({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const { notify } = useToast();
  const { data, loading, error, reload } = useResource(() => orders.byId(order.id), [order.id]);
  const allowed = TRANSITIONS[order.status];
  const [status, setStatus] = useState<OrderStatus | ''>(allowed[0] ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const lines = data?.items ?? order.items;

  const apply = async (event: FormEvent) => {
    event.preventDefault();
    if (!status) {
      notify('Selecciona el nuevo estado.', 'danger');
      return;
    }
    const trimmed = note.trim();
    if (trimmed.length > 240) {
      notify('La observación admite máximo 240 caracteres.', 'danger');
      return;
    }
    setSaving(true);
    try {
      await orders.setStatus(order.id, status, trimmed === '' ? undefined : trimmed);
      notify(`El pedido pasó a ${ORDER_LABELS[status].toLowerCase()}.`, 'success');
      onChanged();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible cambiar el estado del pedido.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Gestionar ${order.code}`} onClose={onClose}>
      <div className="stack">
        <div className="row-between">
          <div className="stat">
            <span className="stat-label">Estado actual</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{formatMoney(order.total, order.currency)}</span>
          </div>
        </div>

        {loading ? <Loading rows={2} /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {lines.length === 0 ? (
          <EmptyState title="Sin líneas" description="El pedido no registra artículos." />
        ) : (
          <Table
            head={['Artículo', 'Cantidad', 'Unitario', 'Subtotal']}
            rows={lines.map((line) => ({
              key: line.id,
              cells: [
                line.productName,
                line.quantity,
                formatMoney(line.unitPrice, order.currency),
                formatMoney(line.lineTotal, order.currency),
              ],
            }))}
          />
        )}

        {allowed.length === 0 ? (
          <Alert tone="info">Este pedido ya está cerrado: no admite más cambios de estado.</Alert>
        ) : (
          <form className="stack" onSubmit={apply}>
            <Field label="Nuevo estado" htmlFor="o-status" hint="Solo se muestran los destinos que la API permite desde el estado actual.">
              <Select id="o-status" value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
                {allowed.map((next) => (
                  <Option key={next} value={next}>{ORDER_LABELS[next]}</Option>
                ))}
              </Select>
            </Field>
            <Field label="Observación" htmlFor="o-note" hint="Opcional, máximo 240 caracteres.">
              <Input id="o-note" value={note} maxLength={240} placeholder="Motivo, transportador, fecha de entrega…" onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className="row">
              <Button type="submit" disabled={saving}>{saving ? 'Aplicando…' : 'Aplicar estado'}</Button>
              <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const { data, loading, error, reload } = useResource(
    () =>
      orders.admin({
        page,
        limit: 10,
        status: status === '' ? undefined : status,
        search: search === '' ? undefined : search,
      }),
    [page, status, search],
  );

  const resetFilters = () => {
    setSearchDraft('');
    setSearch('');
    setStatus('');
    setPage(1);
  };

  return (
    <div className="stack">
      <PageHeader title="Pedidos" subtitle="RF-09 y RF-12 · Ciclo de vida de cada pedido." />

      <Card tight>
        <form className="row" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}>
          <Field label="Buscar" htmlFor="o-search">
            <Input id="o-search" value={searchDraft} maxLength={80} placeholder="Código o nombre del cliente" onChange={(event) => setSearchDraft(event.target.value)} />
          </Field>
          <Field label="Estado" htmlFor="o-filter-status">
            <Select id="o-filter-status" value={status} onChange={(event) => { setStatus(event.target.value as '' | OrderStatus); setPage(1); }}>
              <Option value="">Todos</Option>
              {STATUS_OPTIONS.map((option) => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">Aplicar</Button>
          <Button type="button" variant="ghost" onClick={resetFilters}>Limpiar</Button>
        </form>
      </Card>

      <Card>
        {loading ? <Loading rows={5} /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data && data.items.length === 0 ? (
          <EmptyState title="Sin pedidos" description="Ningún pedido coincide con el estado o la búsqueda seleccionada." />
        ) : null}
        {data && data.items.length > 0 ? (
          <>
            <Table
              head={['Código', 'Creado', 'Tipo', 'Total', 'Estado', 'Acción']}
              rows={data.items.map((order) => ({
                key: order.id,
                cells: [
                  order.code,
                  formatDateTime(order.createdAt),
                  typeBadge(order),
                  formatMoney(order.total, order.currency),
                  <OrderStatusBadge status={order.status} />,
                  manageAction(order, setSelected),
                ],
              }))}
            />
            <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} label="pedidos" />
          </>
        ) : null}
      </Card>

      {selected ? (
        <ManageDialog
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); reload(); }}
        />
      ) : null}
    </div>
  );
}
