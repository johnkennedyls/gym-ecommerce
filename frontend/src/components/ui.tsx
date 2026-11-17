import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { BookingStatus, MembershipStatus, OrderStatus, PaymentStatus } from '../types/api';

/* ---------------- Botones ---------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
  size?: 'md' | 'sm';
};

export function Button({
  variant = 'primary',
  block = false,
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    block ? 'btn-block' : '',
    size === 'sm' ? 'btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}

type LinkButtonProps = {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
};

export function LinkButton({ to, children, variant = 'primary', className = '' }: LinkButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  return <Link to={to} className={classes}>{children}</Link>;
}

/* ---------------- Formularios ---------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`control ${className}`.trim()} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`control ${className}`.trim()} {...rest} />;
  },
);

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`control ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

export function Option({ value, children }: { value: string; children: ReactNode }) {
  return <option value={value}>{children}</option>;
}

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? (
        <span className="field-hint" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/* ---------------- Superficies ---------------- */

export function Card({
  children,
  title,
  actions,
  tight = false,
}: {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={`card ${tight ? 'card-tight' : ''}`}>
      {title || actions ? (
        <div className="row-between" style={{ marginBottom: tight ? 'var(--space-3)' : 'var(--space-4)' }}>
          {title ? <h3 style={{ margin: 0 }}>{title}</h3> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
}) {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function Money({ value, currency }: { value: number; currency?: string }) {
  return <span className="price">{formatMoney(value, currency)}</span>;
}

/* ---------------- Estados ---------------- */

export function Skeleton({ height = '1rem', width }: { height?: string; width?: string }) {
  return <div className="skeleton" style={{ height, width }} />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-media" />
      <Skeleton height="0.8rem" width="40%" />
      <Skeleton height="1.1rem" width="80%" />
      <Skeleton height="1.1rem" width="35%" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="list-item card-flat">
          <div className="stack" style={{ gap: 'var(--space-2)', flex: 1 }}>
            <Skeleton height="1rem" width="45%" />
            <Skeleton height="0.8rem" width="25%" />
          </div>
          <Skeleton height="2rem" width="6rem" />
        </div>
      ))}
    </div>
  );
}

export function Loading({ label = 'Cargando…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="stack" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <SkeletonList rows={rows} />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {description ? <p className="muted tiny">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert" data-tone="danger" role="alert">
      <div className="row-between">
        <span>{message}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'danger';
  children: ReactNode;
}) {
  return (
    <div className="alert" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/* ---------------- Paginación ---------------- */

export function Pager({
  page,
  totalPages,
  onChange,
  label = 'resultados',
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label={`Paginación de ${label}`}>
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Página anterior"
      >
        ← Anterior
      </Button>
      <span className="tiny muted">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Página siguiente"
      >
        Siguiente →
      </Button>
    </nav>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Etiquetas de estado ---------------- */

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const ORDER_TONES: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'info',
  PREPARING: 'info',
  SHIPPED: 'accent',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  CREATED: 'neutral',
  APPROVED: 'success',
  DECLINED: 'danger',
  ERROR: 'danger',
};

const BOOKING_TONES: Record<BookingStatus, Tone> = {
  CONFIRMED: 'info',
  ATTENDED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
};

const MEMBERSHIP_TONES: Record<MembershipStatus, Tone> = {
  ACTIVE: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
};

export const ORDER_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagado',
  PREPARING: 'En preparación',
  SHIPPED: 'Enviado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  CREATED: 'Creado',
  APPROVED: 'Aprobado',
  DECLINED: 'Rechazado',
  ERROR: 'Error',
};

export const BOOKING_LABELS: Record<BookingStatus, string> = {
  CONFIRMED: 'Confirmada',
  ATTENDED: 'Asistió',
  NO_SHOW: 'No asistió',
  CANCELLED: 'Cancelada',
};

export const MEMBERSHIP_LABELS: Record<MembershipStatus, string> = {
  ACTIVE: 'Activa',
  EXPIRED: 'Vencida',
  CANCELLED: 'Cancelada',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONES[status]}>{ORDER_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONES[status]}>{PAYMENT_LABELS[status]}</Badge>;
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={BOOKING_TONES[status]}>{BOOKING_LABELS[status]}</Badge>;
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  return <Badge tone={MEMBERSHIP_TONES[status]}>{MEMBERSHIP_LABELS[status]}</Badge>;
}
