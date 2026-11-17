import { expect, test } from '@playwright/test';

/**
 * RF-02 (registro), RF-03 (recuperación) y el rechazo de credenciales inválidas.
 * Corre sin sesión porque el registro y el acceso son el punto de entrada del usuario nuevo.
 */
test.describe('cuenta y acceso', () => {
  test('las credenciales incorrectas se avisan sin cambiar de página', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@gymsoftware.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('no-es-mi-clave');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas');
    await expect(page).toHaveURL(/\/login/);
  });

  test('el registro crea la cuenta y abre la tienda con sesión', async ({ page }) => {
    const correo = `e2e.${Date.now()}@gymsoftware.test`;
    await page.goto('/registro');
    await page.getByLabel('Nombres').fill('Alumna');
    await page.getByLabel('Apellidos').fill('Prueba');
    await page.getByLabel('Correo electrónico').fill(correo);
    await page.getByLabel('Contraseña', { exact: true }).fill('Clave12345');
    await page.getByLabel('Repite la contraseña').fill('Clave12345');
    await page.getByRole('button', { name: 'Registrarme' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /^Carrito/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Notificaciones/ })).toBeVisible();

    await page.goto('/pedidos');
    await expect(page.getByRole('heading', { name: 'Mis pedidos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No tenemos pedidos con este filtro' })).toBeVisible();
  });

  test('la recuperación responde igual para un correo registrado', async ({ page }) => {
    await page.goto('/recuperar');
    await page.getByLabel('Correo electrónico').fill('cliente@gymsoftware.test');
    await page.getByRole('button', { name: 'Enviar instrucciones' }).click();
    await expect(
      page.getByText('Si el correo está registrado, recibirás instrucciones'),
    ).toBeVisible();
  });

  test('una contraseña sin mayúscula ni número se rechaza en el formulario', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Nombres').fill('Alumno');
    await page.getByLabel('Apellidos').fill('Prueba');
    await page.getByLabel('Correo electrónico').fill('debil@gymsoftware.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('aaaaaaaaaaaa');
    await page.getByLabel('Repite la contraseña').fill('aaaaaaaaaaaa');
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await expect(page.getByRole('alert')).toContainText('una mayúscula, una minúscula y un número');
    await expect(page).toHaveURL(/\/registro/);
  });
});
