/**
 * Variables de entorno de la suite de pruebas de integración.
 * Jest la carga en `setupFiles`, antes de importar la aplicación, para que los
 * decoradores de limitación de tasa lean valores amplios y las pruebas no
 * discutan con el control de fuerza bruta (RNF-01).
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST ??= 'localhost';
process.env.DATABASE_PORT ??= '5432';
process.env.DATABASE_USER ??= 'postgres';
process.env.DATABASE_PASSWORD ??= 'password';
process.env.DATABASE_NAME ??= 'gymsoftware';
process.env.JWT_ACCESS_SECRET ??= 'acces-secret-de-prueba-1234';
process.env.JWT_REFRESH_SECRET ??= 'refresh-secret-de-prueba-1234';
process.env.SANDBOX_STRICT_MODE ??= 'true';
process.env.APP_CORS_ORIGIN ??= 'http://localhost:5173';

process.env.THROTTLE_LIMIT ??= '100000';
process.env.THROTTLE_REGISTER_LIMIT ??= '100000';
process.env.THROTTLE_LOGIN_LIMIT ??= '100000';
process.env.THROTTLE_RECOVERY_LIMIT ??= '100000';
