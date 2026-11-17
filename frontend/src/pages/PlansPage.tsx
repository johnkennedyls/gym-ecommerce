import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  SkeletonCard,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { memberships, orders } from '../lib/api';
import { formatMoney } from '../lib/format';
import { ApiError } from '../lib/session';
import { useResource } from '../lib/useResource';
import type { MembershipLevel, Plan } from '../types/api';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const LEVELS: Record<MembershipLevel, { label: string; tone: BadgeTone }> = {
  BASIC: { label: 'Acceso básico', tone: 'neutral' },
  PREMIUM: { label: 'Acceso premium', tone: 'accent' },
  ATHLETE: { label: 'Acceso atleta', tone: 'info' },
};

export function PlansPage() {
  const { data, loading, error, reload } = useResource(() => memberships.plans(), []);
  const { isAuthenticated } = useAuth();
  const [buying, setBuying] = useState<string | undefined>(undefined);

  return (
    <>
      <PageHeader
        title="Membresías"
        subtitle="Escoge el plan que se ajusta a tu entrenamiento. Puedes cancelarlo cuando quieras."
      />

      <div className="stack">
        {!isAuthenticated ? (
          <Alert tone="info">Regístrate o inicia sesión para comprar una membresía con tarjeta.</Alert>
        ) : null}

        {loading ? (
          <div className="grid grid-cards">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : null}

        {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!loading && !error && data && data.length === 0 ? (
          <EmptyState
            title="No hay planes disponibles"
            description="Estamos actualizando las membresías. Vuelve a consultar pronto."
            action={<LinkButton to="/">Ver catálogo</LinkButton>}
          />
        ) : null}

        {!loading && !error && data && data.length > 0 ? (
          <div className="grid grid-cards">
            {data.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                busy={buying === plan.id}
                disabled={buying !== undefined}
                isAuthenticated={isAuthenticated}
                onBuying={setBuying}
              />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function PlanCard({
  plan,
  busy,
  disabled,
  isAuthenticated,
  onBuying,
}: {
  plan: Plan;
  busy: boolean;
  disabled: boolean;
  isAuthenticated: boolean;
  onBuying: (id: string | undefined) => void;
}) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const level = LEVELS[plan.accessLevel] ?? { label: plan.accessLevel, tone: 'neutral' as BadgeTone };

  const buy = async () => {
    onBuying(plan.id);
    try {
      const order = await orders.buyMembership(plan.id);
      navigate(`/pedidos/${order.id}`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'No fue posible crear el pedido', 'danger');
      onBuying(undefined);
    }
  };

  return (
    <Card title={plan.name} tight>
      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Badge tone={level.tone}>{level.label}</Badge>
          {plan.includesClasses ? <Badge tone="success">Incluye clases</Badge> : null}
        </div>
        <div className="stat">
          <span className="stat-value">{formatMoney(plan.price, plan.currency)}</span>
          <span className="stat-label">{plan.durationDays} días de acceso</span>
        </div>
        <p className="muted tiny" style={{ margin: 0 }}>
          {plan.description ?? 'Entrenamiento libre en todas las sedes.'}
        </p>
        {isAuthenticated ? (
          <Button onClick={buy} disabled={disabled || busy} block>
            {busy ? 'Creando pedido…' : 'Comprar membresía'}
          </Button>
        ) : (
          <LinkButton to="/registro" className="btn-block">
            Regístrate para comprar
          </LinkButton>
        )}
      </div>
    </Card>
  );
}
