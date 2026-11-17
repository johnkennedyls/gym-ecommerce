import { randomUUID } from 'crypto';
import { ChargeRequest, GatewayResult, PaymentGateway } from './payment-gateway.port';

const ONLY_DIGITS = /\D/g;

/** Algoritmo de Luhn: validación local del número de tarjeta antes de llamar la pasarela. */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(ONLY_DIGITS, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

export function isExpiredCard(expiryMonth: number, expiryYear: number, now: Date = new Date()): boolean {
  const lastSecondOfMonth = new Date(Date.UTC(expiryYear, expiryMonth, 0, 23, 59, 59));
  return lastSecondOfMonth < now;
}

export const lastFour = (cardNumber: string): string => cardNumber.replace(ONLY_DIGITS, '').slice(-4);

/**
 * Adaptador de pruebas de la pasarela (RF-08). No procesa dinero real: aplica reglas
 * deterministas para poder ejecutar los flujos de compra, rechazo y error en el
 * entorno académico, y nunca conserva el número completo de la tarjeta (RNF-10).
 */
export class SandboxPaymentGateway implements PaymentGateway {
  readonly name = 'SANDBOX';

  constructor(
    private readonly strictMode = true,
    private readonly latencyMs = 120,
  ) {}

  async charge(request: ChargeRequest): Promise<GatewayResult> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    const digits = request.card.number.replace(ONLY_DIGITS, '');
    const reference = `SBX-${request.orderCode}-${randomUUID().slice(0, 8)}`;

    if (digits.length < 13) {
      return { status: 'ERROR', reference: null, message: 'El número de tarjeta no es válido', last4: null };
    }
    if (this.strictMode && !isValidLuhn(digits)) {
      return { status: 'ERROR', reference: null, message: 'El número de tarjeta falla la validación de Luhn', last4: lastFour(digits) };
    }
    if (isExpiredCard(request.card.expiryMonth, request.card.expiryYear)) {
      return { status: 'DECLINED', reference, message: 'La tarjeta está vencida', last4: lastFour(digits) };
    }
    if (this.strictMode && request.amount > 5_000_000) {
      return { status: 'DECLINED', reference, message: 'El monto supera el límite permitido en el entorno de pruebas', last4: lastFour(digits) };
    }
    // Tarjeta de prueba dedicada a rechazos: termina en 0002.
    if (digits.endsWith('0002')) {
      return { status: 'DECLINED', reference, message: 'La pasarela rechazó la transacción', last4: lastFour(digits) };
    }

    return { status: 'APPROVED', reference, message: null, last4: lastFour(digits) };
  }
}
