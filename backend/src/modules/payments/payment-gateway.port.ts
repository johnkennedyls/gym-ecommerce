export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type CardInput = {
  number: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
};

export type ChargeRequest = {
  orderCode: string;
  amount: number;
  currency: string;
  card: CardInput;
  idempotencyKey?: string;
};

export type GatewayResult = {
  status: 'APPROVED' | 'DECLINED' | 'ERROR';
  reference: string | null;
  message: string | null;
  last4: string | null;
};

/**
 * RF-08: el dominio depende de este puerto, no del proveedor concreto.
 * Cambiar de pasarela (Bold, Stripe, Mercado Pago) solo implica aportar otro adaptador.
 */
export interface PaymentGateway {
  readonly name: string;
  charge(request: ChargeRequest): Promise<GatewayResult>;
}
