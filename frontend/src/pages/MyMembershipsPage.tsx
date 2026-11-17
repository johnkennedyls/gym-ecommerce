import { useState } from 'react';
import { PageHeader } from '../components/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
  MembershipStatusBadge,
} from '../components/ui';
import { useToast } from '../context/ToastContext';
import { memberships } from '../lib/api';
import { formatDate, relativeDays } from '../lib/format';
import { ApiError } from '../lib/session';
import { useResource } from '../lib/useResource';
import type { Membership } from '../types/api';

export function MyMembershipsPage() {
  const { data, loading, error, reload } = useResource(() => memberships.mine(), []);
  const { notify } = useToast();
  const [cancelling, setCancelling] = useState<string | undefined>(undefined);

  const cancel = async (membership: Membership) => {
    if (!window.confirm(`¿Cancelar tu membresía ${membership.plan.name}?`)) return;
    setCancelling(membership.id);
    try {
      await memberships.cancel(membership.id);
      notify('Membresía cancelada', 'success');
      reload();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible cancelar la membresía', 'danger');
    } finally {
      setCancelling(undefined);
    }
  };

  return (
    <>
      <PageHeader
        title="Mi membresía"
        subtitle="Revisa tus planes activos, sus fechas de vencimiento y tu historial."
        actions={<LinkButton to="/membresias">Comprar otro plan</LinkButton>}
      />

      {loading ? <Loading rows={3} /> : null}

      {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}

      {!loading && !error && data && data.length === 0 ? (
        <EmptyState
          title="Todavía no tienes membresías"
          description="Compra un plan para entrenar sin límites en la sede."
          action={<LinkButton to="/membresias">Ver planes</LinkButton>}
        />
      ) : null}

      {!loading && !error && data && data.length > 0 ? (
        <div className="list">
          {data.map((membership) => (
            <MembershipRow
              key={membership.id}
              membership={membership}
              busy={cancelling === membership.id}
              onCancel={() => void cancel(membership)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function MembershipRow({
  membership,
  busy,
  onCancel,
}: {
  membership: Membership;
  busy: boolean;
  onCancel: () => void;
}) {
  const active = membership.status === 'ACTIVE';
  return (
    <article className="list-item">
      <div className="stack" style={{ gap: 'var(--space-2)', flex: 1 }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <strong>{membership.plan.name || 'Membresía'}</strong>
          <MembershipStatusBadge status={membership.status} />
        </div>
        <span className="tiny muted">
          {formatDate(membership.startDate)} → {formatDate(membership.endDate)}
          {active ? ` · vence ${relativeDays(membership.daysRemaining)}` : ''}
        </span>
      </div>
      {active ? (
        <Button variant="danger" size="sm" onClick={onCancel} disabled={busy}>
          {busy ? 'Cancelando…' : 'Cancelar membresía'}
        </Button>
      ) : (
        <span className="tiny muted">
          {membership.status === 'EXPIRED' ? 'Periodo finalizado' : 'Sin acciones disponibles'}
        </span>
      )}
    </article>
  );
}
