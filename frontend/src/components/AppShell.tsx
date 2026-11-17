import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { initials } from '../lib/format';
import { Button } from './ui';

const CLIENT_LINKS = [
  { to: '/', label: 'Catálogo', end: true },
  { to: '/membresias', label: 'Membresías', end: false },
  { to: '/clases', label: 'Clases', end: false },
];

const ACCOUNT_LINKS = [
  { to: '/pedidos', label: 'Mis pedidos' },
  { to: '/mis-membresias', label: 'Mi membresía' },
  { to: '/mis-reservas', label: 'Mis reservas' },
];

const ADMIN_LINKS = [{ to: '/admin', label: 'Administración' }];

function HeaderLink({ to, label, end }: { to: string; label: string; end: boolean }) {
  return (
    <NavLink to={to} end={end}>
      {label}
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, hasRole, ready, logout } = useAuth();
  const { units } = useCart();
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const loadUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setUnread(0);
      return;
    }
    try {
      const data = await notifications.list(1);
      setUnread(data.unread);
    } catch {
      setUnread(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread, location.pathname]);

  useEffect(() => {
    const handler = () => void loadUnread();
    window.addEventListener('gymsoftware:notifications-changed', handler);
    return () => window.removeEventListener('gymsoftware:notifications-changed', handler);
  }, [loadUnread]);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const links = [
    ...CLIENT_LINKS,
    ...(isAuthenticated ? ACCOUNT_LINKS.map((item) => ({ ...item, end: false })) : []),
    ...(hasRole('ADMIN') ? ADMIN_LINKS.map((item) => ({ ...item, end: false })) : []),
  ];

  return (
    <div className="layout">
      <a className="skip-link" href="#contenido">
        Saltar al contenido principal
      </a>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              ⛰
            </span>
            GymSoftware
          </Link>

          <nav className="nav" aria-label="Navegación principal">
            {links.map((link) => (
              <HeaderLink key={link.to} to={link.to} label={link.label} end={link.end} />
            ))}
          </nav>

          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <Link to="/notificaciones" className="icon-button" aria-label={`Notificaciones (${unread} sin leer)`}>
                  🔔
                  {unread > 0 ? (
                    <span className="counter" data-tone="accent">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </Link>
                <Link to="/carrito" className="icon-button" aria-label={`Carrito (${units} artículos)`}>
                  🛒
                  {units > 0 ? <span className="counter">{units}</span> : null}
                </Link>
              </>
            ) : null}

            {!ready ? null : isAuthenticated && user ? (
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <Link to="/perfil" className="badge" data-tone="accent" title={user.email}>
                  {initials(user.firstName, user.lastName)} · {user.firstName}
                </Link>
                <Button variant="ghost" size="sm" onClick={onLogout}>
                  Salir
                </Button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary">
                Ingresar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="contenido" className="page">
        {children}
      </main>

      <footer className="footer">
        GymSoftware · Proyecto de Calidad de Software — FUP 2026 · API REST documentada en{' '}
        <a href="/api/docs" target="_blank" rel="noreferrer">
          /api/docs
        </a>
      </footer>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="row-between" style={{ marginBottom: 'var(--space-5)', gap: 'var(--space-4)' }}>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}
