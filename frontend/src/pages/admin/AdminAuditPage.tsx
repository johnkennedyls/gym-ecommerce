import { useState, type CSSProperties } from 'react';
import { PageHeader } from '../../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Option,
  Select,
} from '../../components/ui';
import { admin } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useResource } from '../../lib/useResource';

const MONO: CSSProperties = {
  fontFamily: 'ui-monospace, Consolas, monospace',
  fontSize: 'var(--text-xs)',
  maxWidth: '11rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'inline-block',
  verticalAlign: 'bottom',
};

const LIMITS = [50, 100, 200, 500];

export function AdminAuditPage() {
  const [limit, setLimit] = useState(100);
  const { data, loading, error, reload } = useResource(() => admin.audit(limit), [limit]);

  return (
    <div className="stack">
      <PageHeader
        title="Bitácora de auditoría"
        subtitle="RNF-09 · Trazabilidad de los eventos administrativos registrados por la API."
      />

      <Alert tone="info">
        Se muestran los eventos más recientes (máximo {limit}). Cada acción de administración se escribe en la
        bitácora junto con la dirección IP del requerimiento.
      </Alert>

      <Card tight>
        <div className="row">
          <Field label="Eventos a consultar" htmlFor="audit-limit">
            <Select
              id="audit-limit"
              value={String(limit)}
              onChange={(event) => setLimit(Number(event.target.value))}
              style={{ width: '12rem' }}
            >
              {LIMITS.map((option) => (
                <Option key={option} value={String(option)}>
                  {option} eventos
                </Option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={reload} disabled={loading}>
            Actualizar bitácora
          </Button>
        </div>
      </Card>

      <Card>
        {loading ? <Loading rows={6} /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data && data.length === 0 ? (
          <EmptyState
            title="Sin eventos registrados"
            description="La bitácora se llena cuando el personal ejecuta operaciones administrativas."
          />
        ) : null}
        {data && data.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Entidad</th>
                  <th scope="col">Identificador</th>
                  <th scope="col">Dirección IP</th>
                  <th scope="col">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>{entry.userId ?? 'Sistema'}</td>
                    <td>
                      <Badge tone="info">{entry.action}</Badge>
                    </td>
                    <td>{entry.entityName}</td>
                    <td>
                      <span style={MONO} title={entry.entityId ?? ''}>
                        {entry.entityId ?? '—'}
                      </span>
                    </td>
                    <td>{entry.ipAddress ?? '—'}</td>
                    <td>
                      <span style={{ ...MONO, maxWidth: '18rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {JSON.stringify(entry.details ?? {}, null, 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <p className="tiny muted" style={{ margin: 0 }}>
        Sugerencia: recarga la bitácora después de cada operación para verificar la trazabilidad (RNF-09).
      </p>
    </div>
  );
}
