import {
  SandboxPaymentGateway,
  isExpiredCard,
  isValidLuhn,
  lastFour,
} from './sandbox-payment.gateway';

const card = {
  number: '4242424242424242',
  holderName: 'Cliente Demo',
  expiryMonth: 12,
  expiryYear: 2030,
  cvv: '123',
};

describe('SandboxPaymentGateway (RF-08)', () => {
  const gateway = new SandboxPaymentGateway(true, 0);

  it('aprueba una tarjeta de prueba válida y devuelve referencia', async () => {
    const result = await gateway.charge({ orderCode: 'O20261020AAA', amount: 100_000, currency: 'COP', card });

    expect(result.status).toBe('APPROVED');
    expect(result.reference).toMatch(/^SBX-O20261020AAA-/);
    expect(result.last4).toBe('4242');
  });

  it('rechaza la tarjeta de pruebas de rechazo 0002', async () => {
    const result = await gateway.charge({
      orderCode: 'O20261020BBB',
      amount: 50_000,
      currency: 'COP',
      card: { ...card, number: '4000000000000002' },
    });

    expect(result.status).toBe('DECLINED');
    expect(result.message).toMatch(/rechaz/);
  });

  it('rechaza montos por encima del límite del entorno de pruebas', async () => {
    const result = await gateway.charge({ orderCode: 'O20261020CCC', amount: 9_000_000, currency: 'COP', card });
    expect(result.status).toBe('DECLINED');
  });

  it('reporta error para números que fallan Luhn sin guardar el PAN', async () => {
    const result = await gateway.charge({
      orderCode: 'O20261020DDD',
      amount: 10_000,
      currency: 'COP',
      card: { ...card, number: '4242424242424243' },
    });

    expect(result.status).toBe('ERROR');
    expect(result.last4).toBe('4243');
    expect(result.reference).toBeNull();
  });

  it('no aplica Luhn cuando la pasarela se configura sin modo estricto', async () => {
    const lenient = new SandboxPaymentGateway(false, 0);
    const result = await lenient.charge({
      orderCode: 'O20261020EEE',
      amount: 10_000,
      currency: 'COP',
      card: { ...card, number: '4242424242424243' },
    });
    expect(result.status).toBe('APPROVED');
  });
});

describe('validaciones locales de tarjeta (RNF-01 / RNF-10)', () => {
  it('valida Luhn', () => {
    expect(isValidLuhn('4242 4242 4242 4242')).toBe(true);
    expect(isValidLuhn('4242424242424243')).toBe(false);
    expect(isValidLuhn('123')).toBe(false);
  });

  it('detecta vencimientos', () => {
    expect(isExpiredCard(1, 2020, new Date('2026-10-20T00:00:00Z'))).toBe(true);
    expect(isExpiredCard(12, 2030, new Date('2026-10-20T00:00:00Z'))).toBe(false);
  });

  it('sólo expone los últimos cuatro dígitos', () => {
    expect(lastFour('4242424242424242')).toBe('4242');
  });
});
