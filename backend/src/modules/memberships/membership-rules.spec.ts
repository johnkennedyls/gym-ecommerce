import { MembershipStatus } from '../../common/enums';
import { resolveMembershipWindow, shouldBeExpired } from './membership-rules';

const now = new Date('2026-10-20T12:00:00Z');

describe('resolveMembershipWindow (RF-10)', () => {
  it('inicia el ciclo en la fecha de compra cuando el cliente no tiene membresía', () => {
    const window = resolveMembershipWindow(null, 'plan-1', 30, now);

    expect(window.startDate).toEqual(now);
    expect(window.endDate.toISOString()).toBe('2026-11-19T12:00:00.000Z');
  });

  it('prorroga el vencimiento cuando renueva el mismo plan estando activo', () => {
    const current = {
      planId: 'plan-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-11-01T12:00:00Z'),
    };

    const window = resolveMembershipWindow(current, 'plan-1', 30, now);
    expect(window.startDate.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(window.endDate > current.endDate).toBe(true);
  });

  it('no acumula días cuando se contrata un plan distinto', () => {
    const current = {
      planId: 'plan-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-12-01T12:00:00Z'),
    };

    const window = resolveMembershipWindow(current, 'plan-2', 90, now);
    expect(window.startDate).toEqual(now);
  });

  it('reactiva desde hoy si la membresía anterior ya venció', () => {
    const current = {
      planId: 'plan-1',
      status: MembershipStatus.EXPIRED,
      endDate: new Date('2026-09-01T12:00:00Z'),
    };

    const window = resolveMembershipWindow(current, 'plan-1', 30, now);
    expect(window.startDate).toEqual(now);
  });

  it('rechaza planes sin duración (RNF-08 validación de reglas)', () => {
    expect(() => resolveMembershipWindow(null, 'plan-1', 0, now)).toThrow(/al menos 1 día/);
  });
});

describe('shouldBeExpired (RF-10)', () => {
  it('marca como vencida una membresía con fecha pasada', () => {
    expect(shouldBeExpired(new Date('2026-10-19T12:00:00Z'), now)).toBe(true);
    expect(shouldBeExpired(new Date('2026-10-21T12:00:00Z'), now)).toBe(false);
  });
});
