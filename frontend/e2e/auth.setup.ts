import { expect, test, type Page } from '@playwright/test';

const CLIENTE = { email: 'cliente@gymsoftware.test', password: 'Cliente1234' };
const ADMIN = { email: 'admin@gymsoftware.test', password: 'Admin1234' };

/**
 * Inicia sesión por la interfaz y guarda el estado (el token vive en localStorage).
 * Cada prueba de este archivo recibe su propio contexto, así que las dos sesiones
 * se capturan limpias y no se pisan entre sí.
 */
async function login(page: Page, account: typeof CLIENTE): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // La cabecera muestra el correo en el enlace de perfil: confirma qué cuenta quedó activa.
  await expect(page.locator('a[href="/perfil"]')).toHaveAttribute('title', account.email);
}

test('guarda la sesión de cliente', async ({ page }) => {
  await login(page, CLIENTE);
  await page.context().storageState({ path: 'e2e/.auth/cliente.json' });
});

test('guarda la sesión de administrador', async ({ page }) => {
  await login(page, ADMIN);
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });
});
