/**
 * RNF-01 / OWASP A7: límites de tasa por grupo de rutas.
 * Se leen del entorno al arrancar el proceso; los valores por defecto son los
 * que se publicarían en producción y la suite de pruebas los relaja.
 */
const integerFrom = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const THROTTLE = {
  global: { limit: integerFrom('THROTTLE_LIMIT', 120), ttl: 60_000 },
  register: { limit: integerFrom('THROTTLE_REGISTER_LIMIT', 5), ttl: 60_000 },
  login: { limit: integerFrom('THROTTLE_LOGIN_LIMIT', 8), ttl: 60_000 },
  recovery: { limit: integerFrom('THROTTLE_RECOVERY_LIMIT', 3), ttl: 300_000 },
} as const;
