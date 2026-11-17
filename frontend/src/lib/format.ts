const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });

export const formatMoney = (value: number, currency = 'COP'): string =>
  currency === 'COP'
    ? moneyFormatter.format(value)
    : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value)} ${currency}`;

export const formatDateTime = (value: string | Date): string => dateTimeFormatter.format(new Date(value));

export const formatDate = (value: string | Date): string => dateFormatter.format(new Date(value));

/** Para `<input type="datetime-local">`, que exige hora local sin zona. */
export const toDateTimeLocal = (value: string | Date): string => {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

export const relativeDays = (days: number): string =>
  days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`;

/** `2026-11-16T07:00:00Z` -> `2026-11-16T07:00:00.000Z` aceptado por IsDateString del backend. */
export const fromDateTimeLocal = (value: string): string => new Date(value).toISOString();

export const initials = (firstName: string, lastName: string): string =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
