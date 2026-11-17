import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas end-to-end de la interfaz (estrategia de pruebas, sección 13 del informe).
 * Requiere la API en http://localhost:3000 con la base sembrada:
 *   backend:  npm run seed && npm run start:dev
 * El servidor de Vite lo levanta esta configuración si no está corriendo.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-CO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'sesion', testMatch: /auth\.setup\.ts/ },
    {
      name: 'publico',
      testMatch: /(catalogo|acceso)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['sesion'],
    },
    {
      name: 'cliente',
      testMatch: /(compra|servicios|roles)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/cliente.json' },
      dependencies: ['sesion'],
    },
    {
      name: 'administrador',
      testMatch: /admin\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['sesion'],
    },
  ],
});
