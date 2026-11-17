import { useState } from 'react';
import { PageHeader } from '../../components/AppShell';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  Option,
  ORDER_LABELS,
  Select,
} from '../../components/ui';
import { admin } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import type { OrderStatus, Role } from '../../types/api';

const ORDER_KEYS = Object.keys(ORDER_LABELS) as OrderStatus[];

const ROLE_LABELS: Record<Role, string> = {
  CLIENT: 'Clientes',
  STAFF: 'Personal',
  ADMIN: 'Administradores',
};

const ROLE_KEYS = Object.keys(ROLE_LABELS) as Role[];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="inset stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export function DashboardPage() {
  const [days, setDays] = useState(30);
  const [threshold, setThreshold] = useState(5);
  const { data, loading, error, reload } = useResource(
    () => admin.dashboard(days, threshold),
    [days, threshold],
  );

  return (
    <div className="stack">
      <PageHeader
        title="Panel de control"
        subtitle={`RF-14 · Resultados de los últimos ${days} días.`}
        actions={
          <>
            <Field label="Periodo" htmlFor="dash-days">
              <Select
                id="dash-days"
                value={String(days)}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <Option value="7">Últimos 7 días</Option>
                <Option value="30">Últimos 30 días</Option>
                <Option value="90">Últimos 90 días</Option>
              </Select>
            </Field>
            <Field label="Umbral de stock bajo" htmlFor="dash-threshold" hint="Entre 0 y 1000 unidades.">
              <Input
                id="dash-threshold"
                type="number"
                min={0}
                max={1000}
                step={1}
                value={threshold}
                onChange={(event) => {
                  const parsed = Math.trunc(Number(event.target.value));
                  setThreshold(Number.isFinite(parsed) ? Math.min(1000, Math.max(0, parsed)) : 5);
                }}
              />
            </Field>
          </>
        }
      />

      {loading ? <Loading rows={6} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data ? (
        <div className="stack">
          <div className="grid grid-two">
            <Stat label="Ventas del periodo" value={formatMoney(data.sales.revenue)} />
            <Stat label="Pedidos pagados" value={data.sales.paidOrders} />
            <Stat label="Ticket promedio" value={formatMoney(data.sales.averageTicket)} />
            <Stat label="Membresías activas" value={data.memberships.active} />
            <Stat label="Reservas confirmadas por cumplir" value={data.bookings.upcomingConfirmed} />
            <Stat label="Productos activos" value={data.inventory.activeProducts} />
          </div>

          <Card title="Usuarios por rol" tight>
            <div className="row">
              {ROLE_KEYS.map((role) => (
                <div key={role} className="inset stat">
                  <span className="stat-label">{ROLE_LABELS[role]}</span>
                  <span className="stat-value">{data.usersByRole[role] ?? 0}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-two">
            <Card title="Pedidos por estado">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Estado</th>
                      <th scope="col">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORDER_KEYS.map((status) => (
                      <tr key={status}>
                        <td>{ORDER_LABELS[status]}</td>
                        <td>{data.ordersByStatus[status] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Productos más vendidos">
              {data.topProducts.length === 0 ? (
                <EmptyState
                  title="Sin ventas en el periodo"
                  description="Cuando haya pedidos pagados verás aquí los artículos con mayor rotación."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Cantidad</th>
                        <th scope="col">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((item) => (
                        <tr key={item.productName}>
                          <td>{item.productName}</td>
                          <td>{item.quantity}</td>
                          <td>{formatMoney(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card title="Inventario con stock bajo">
            {data.inventory.lowStock.length === 0 ? (
              <EmptyState
                title="Nada en nivel crítico"
                description={`Ningún artículo está en ${threshold} unidades o menos.`}
              />
            ) : (
              <div className="stack">
                <Alert tone="danger">
                  {data.inventory.lowStock.length} artículos alcanzaron el umbral crítico (
                  {threshold} unidades o menos). Ajusta las existencias en Productos.
                </Alert>
                <div className="list">
                  {data.inventory.lowStock.map((item) => (
                    <div key={item.sku} className="list-item card-flat">
                      <div>
                        <strong>{item.name}</strong>
                        <p className="tiny muted" style={{ margin: 0 }}>
                          SKU {item.sku}
                        </p>
                      </div>
                      <Badge tone="danger">{item.stock ?? 0} disponibles</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div>
            <h2 className="section-title">Gestión</h2>
            <div className="grid grid-two">
              <LinkButton to="/admin/productos" variant="secondary">
                Productos y categorías
              </LinkButton>
              <LinkButton to="/admin/pedidos" variant="secondary">
                Pedidos
              </LinkButton>
              <LinkButton to="/admin/usuarios" variant="secondary">
                Usuarios y roles
              </LinkButton>
              <LinkButton to="/admin/planes" variant="secondary">
                Planes de membresía
              </LinkButton>
              <LinkButton to="/admin/horarios" variant="secondary">
                Horarios de clases
              </LinkButton>
              <LinkButton to="/admin/reservas" variant="secondary">
                Reservas y asistencia
              </LinkButton>
              <LinkButton to="/admin/auditoria" variant="secondary">
                Auditoría
              </LinkButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
