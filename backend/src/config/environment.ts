export type AppEnvironment = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  appName: string;
  corsOrigin: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  paymentGateway: 'sandbox';
  sandboxStrictMode: boolean;
  notificationsTransport: 'log' | 'smtp';
};

const REQUIRED = [
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export type EnvGetter = (key: string) => string | undefined;

/** Construye la configuración tipada y valida lo indispensable antes de arrancar el servidor. */
export function loadEnvironment(read: EnvGetter = (key) => process.env[key]): AppEnvironment {
  const missing = REQUIRED.filter((key) => !read(key));
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
  }

  const nodeEnv = (read('NODE_ENV') ?? 'development') as AppEnvironment['nodeEnv'];
  const accessSecret = read('JWT_ACCESS_SECRET') as string;
  const refreshSecret = read('JWT_REFRESH_SECRET') as string;
  if (accessSecret.length < 16 || refreshSecret.length < 16) {
    throw new Error('Los secretos de JWT deben tener al menos 16 caracteres');
  }

  const baseName = read('DATABASE_NAME') ?? 'gymsoftware';

  return {
    nodeEnv,
    port: Number(read('PORT') ?? 3000),
    appName: read('APP_NAME') ?? 'GymSoftware',
    corsOrigin: read('APP_CORS_ORIGIN') ?? 'http://localhost:5173',
    database: {
      host: read('DATABASE_HOST') ?? 'localhost',
      port: Number(read('DATABASE_PORT') ?? 5432),
      user: read('DATABASE_USER') as string,
      password: read('DATABASE_PASSWORD') as string,
      name: nodeEnv === 'test' ? `${baseName}_test` : baseName,
    },
    jwt: {
      accessSecret,
      accessExpiresIn: read('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      refreshSecret,
      refreshExpiresIn: read('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    },
    paymentGateway: 'sandbox',
    sandboxStrictMode: (read('SANDBOX_STRICT_MODE') ?? 'true') === 'true',
    notificationsTransport: (read('NOTIFICATIONS_TRANSPORT') ?? 'log') as AppEnvironment['notificationsTransport'],
  };
}
