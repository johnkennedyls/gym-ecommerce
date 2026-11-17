import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types/api';
import { EmptyState, SkeletonList } from './ui';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <SkeletonList rows={3} />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, isAuthenticated, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <SkeletonList rows={3} />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!user || !roles.includes(user.role)) {
    return (
      <EmptyState
        title="Acceso restringido"
        description="Tu cuenta no tiene el rol necesario para ver esta pantalla."
      />
    );
  }
  return <>{children}</>;
}
