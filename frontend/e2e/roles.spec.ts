import { expect, test } from '@playwright/test';

/**
 * RNF-01 y RF-02: las guardas de sesión y de rol viven en el enrutador, así que se prueban por la interfaz.
 * Corre con la sesión guardada de cliente.
 */
test.describe('guardas de sesión y de rol', () => {
  test('el cliente no alcanza las pantallas de administración', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Panel de control' })).toHaveCount(0);

    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();

    await page.goto('/admin/auditoria');
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
  });

  test('el perfil muestra la cuenta y Salir devuelve la tienda pública', async ({ page }) => {
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toHaveValue('cliente@gymsoftware.test');

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});
