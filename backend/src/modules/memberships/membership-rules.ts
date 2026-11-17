import { MembershipStatus } from '../../common/enums';

export type ExistingMembership = {
  status: MembershipStatus;
  endDate: Date;
  planId: string;
};

export type MembershipWindow = { startDate: Date; endDate: Date };

const DAY_MS = 86_400_000;

/**
 * Regla de membresías (RF-10): si el cliente conserva una membresía activa del mismo plan,
 * la renovación prorrogó la fecha de vencimiento; en caso contrario el ciclo inicia ahora.
 * Función pura para poder cubrirla con prueba unitaria (ISO/IEC 25010 comprobabilidad).
 */
export function resolveMembershipWindow(
  current: ExistingMembership | null,
  planId: string,
  durationDays: number,
  now: Date = new Date(),
): MembershipWindow {
  if (durationDays < 1) throw new Error('La duración del plan debe ser de al menos 1 día');

  const isSameActivePlan =
    current !== null && current.planId === planId && current.status === MembershipStatus.ACTIVE && current.endDate > now;

  const startDate = isSameActivePlan ? current!.endDate : now;
  return { startDate, endDate: new Date(startDate.getTime() + durationDays * DAY_MS) };
}

/** Miembros cuyo vencimiento ya pasó deben figurar como EXPIRED (consistencia mostrada al usuario). */
export function shouldBeExpired(endDate: Date, now: Date = new Date()): boolean {
  return endDate <= now;
}
