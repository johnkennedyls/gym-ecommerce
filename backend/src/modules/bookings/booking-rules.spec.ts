import { canCancel, evaluateBookingEligibility } from './booking-rules';

const now = new Date('2026-10-20T12:00:00Z');
const future = new Date(now.getTime() + 24 * 3_600_000);

const base = {
  isActive: true,
  startsAt: future,
  now,
  taken: 0,
  capacity: 10,
  alreadyBooked: false,
};

describe('evaluateBookingEligibility (RF-11)', () => {
  it('permite reservar una clase futura con cupo', () => {
    expect(evaluateBookingEligibility(base)).toEqual({ allowed: true, reason: null });
  });

  it('bloquea clases desactivadas por el personal', () => {
    expect(evaluateBookingEligibility({ ...base, isActive: false })).toMatchObject({
      allowed: false,
      reason: 'La clase no está disponible',
    });
  });

  it('bloquea clases que ya comenzaron', () => {
    expect(evaluateBookingEligibility({ ...base, startsAt: new Date(now.getTime() - 60_000) }).allowed).toBe(false);
  });

  it('impide reservar dos veces la misma clase', () => {
    expect(evaluateBookingEligibility({ ...base, alreadyBooked: true }).reason).toMatch(/Ya tienes reserva/);
  });

  it('no permite superar la capacidad (RNF-08 integridad)', () => {
    expect(evaluateBookingEligibility({ ...base, taken: 10 }).reason).toMatch(/llena/);
    expect(evaluateBookingEligibility({ ...base, taken: 9 }).allowed).toBe(true);
  });
});

describe('canCancel (RF-11)', () => {
  it('admite cancelación hasta dos horas antes', () => {
    expect(canCancel(new Date(now.getTime() + 3 * 3_600_000), now)).toBe(true);
    expect(canCancel(new Date(now.getTime() + 60 * 60_000), now)).toBe(false);
  });
});
