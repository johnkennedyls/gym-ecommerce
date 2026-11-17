import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** Genera un token opaco con entropía de 256 bits. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('hex');

/** Los tokens de sesión y de recuperación se almacenan solo como huella SHA-256. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const tokensMatch = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Convierte "15m", "7d" o "12h" a milisegundos. */
export const parseDurationMs = (value: string): number => {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Duración inválida: ${value}`);
  return Number(match[1]) * UNIT_MS[match[2]];
};
