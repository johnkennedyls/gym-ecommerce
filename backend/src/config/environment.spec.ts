import { loadEnvironment } from './environment';
import { hashToken, parseDurationMs, randomToken, tokensMatch } from '../common/security/tokens';

const valid = {
  NODE_ENV: 'development',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'password',
  DATABASE_NAME: 'gymsoftware',
  JWT_ACCESS_SECRET: 'secret-de-acceso-largo',
  JWT_REFRESH_SECRET: 'secret-de-refresh-largo',
};

const read = (values: Record<string, string>) => (key: string) => values[key];

describe('loadEnvironment (configuración verificable, ISO/IEC 25010)', () => {
  it('construye la configuración con valores por defecto', () => {
    const environment = loadEnvironment(read(valid));

    expect(environment.database.name).toBe('gymsoftware');
    expect(environment.database.port).toBe(5432);
    expect(environment.jwt.accessExpiresIn).toBe('15m');
    expect(environment.port).toBe(3000);
  });

  it('usa la base de datos de pruebas cuando NODE_ENV=test', () => {
    const environment = loadEnvironment(read({ ...valid, NODE_ENV: 'test' }));
    expect(environment.database.name).toBe('gymsoftware_test');
  });

  it('falla de forma temprana si faltan credenciales (RNF-03 fiabilidad)', () => {
    expect(() => loadEnvironment(read({ NODE_ENV: 'development' }))).toThrow(/obligatorias/);
  });

  it('rechaza secretos cortos de JWT (RNF-01 seguridad)', () => {
    expect(() => loadEnvironment(read({ ...valid, JWT_ACCESS_SECRET: 'corto' }))).toThrow(/16 caracteres/);
  });
});

describe('utilidades de token (RNF-01 / RNF-09)', () => {
  it('genera huellas estables y comparables en tiempo constante', () => {
    const token = randomToken();
    expect(token).toHaveLength(64);
    expect(hashToken(token)).toHaveLength(64);
    expect(tokensMatch(hashToken(token), hashToken(token))).toBe(true);
    expect(tokensMatch(hashToken(token), hashToken(`${token}x`))).toBe(false);
  });

  it('convierte duraciones a milisegundos', () => {
    expect(parseDurationMs('15m')).toBe(900_000);
    expect(parseDurationMs('7d')).toBe(604_800_000);
    expect(() => parseDurationMs('15 minutos')).toThrow(/Duración inválida/);
  });
});
