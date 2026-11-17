export type BookingCheckInput = {
  isActive: boolean;
  startsAt: Date;
  now: Date;
  taken: number;
  capacity: number;
  alreadyBooked: boolean;
};

export type BookingCheckResult = { allowed: boolean; reason: string | null };

/**
 * Reglas de reserva de clases (RF-11). Función pura: se puede verificar con pruebas
 * unitarias sin base de datos (ISO/IEC 25010: comprobabilidad y mantenibilidad).
 */
export function evaluateBookingEligibility(input: BookingCheckInput): BookingCheckResult {
  if (!input.isActive) return { allowed: false, reason: 'La clase no está disponible' };
  if (input.startsAt <= input.now) return { allowed: false, reason: 'La clase ya comenzó' };
  if (input.alreadyBooked) return { allowed: false, reason: 'Ya tienes reserva en esta clase' };
  if (input.taken >= input.capacity) return { allowed: false, reason: 'La clase está llena' };
  return { allowed: true, reason: null };
}

/** Ventana de cancelación: el cliente puede cancelar hasta 2 horas antes del inicio. */
export const CANCELLATION_WINDOW_HOURS = 2;

export function canCancel(startsAt: Date, now: Date = new Date()): boolean {
  return startsAt.getTime() - now.getTime() >= CANCELLATION_WINDOW_HOURS * 3_600_000;
}
