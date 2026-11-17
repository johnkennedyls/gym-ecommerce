import { expect, test, type Page } from '@playwright/test';

const PLAN = 'Mensual Básico';

async function pagarConTarjetaValida(page: Page): Promise<void> {
  await page.getByLabel('Número de tarjeta').fill('4242 4242 4242 4242');
  await page.getByLabel('Titular').fill('CLIENTE DEMO');
  await page.getByLabel('Mes').fill('12');
  await page.getByLabel('Año').fill(String(new Date().getFullYear() + 2));
  await page.getByLabel('CVV').fill('123');
  await page.getByRole('button', { name: /^Pagar/ }).click();
  await expect(page.getByText('Pagado').first()).toBeVisible();
}

/** Alta de una cuenta al vuelo: el cliente sembrado ya tiene las clases del seed reservadas. */
async function registrarCliente(page: Page): Promise<void> {
  await page.goto('/registro');
  await page.getByLabel('Nombres').fill('Reservas');
  await page.getByLabel('Apellidos').fill('Prueba');
  await page.getByLabel('Correo electrónico').fill(`e2e.reserva.${Date.now()}@gymsoftware.test`);
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave12345');
  await page.getByLabel('Repite la contraseña').fill('Clave12345');
  await page.getByRole('button', { name: 'Registrarme' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('a[href="/perfil"]')).toBeVisible();
}

/**
 * RF-10 (membresías), RF-11/RF-12 (reservas) y RF-13 (notificaciones) desde la interfaz del cliente.
 */
test.describe('servicios del cliente', () => {
  test('una cuenta nueva reserva una clase y lee la notificación confirmada', async ({ page }) => {
    await registrarCliente(page);

    await page.goto('/clases');
    await expect(page.getByRole('heading', { level: 1, name: 'Clases y servicios' })).toBeVisible();

    const tarjeta = page
      .locator('.card')
      .filter({ has: page.getByRole('button', { name: 'Reservar' }) })
      .first();
    await expect(tarjeta).toBeVisible();
    const titulo = (await tarjeta.getByRole('heading').first().innerText()).trim();

    await tarjeta.getByRole('button', { name: 'Reservar' }).click();

    // Al confirmarse la reserva cambia la tarjeta: se vuelve a localizar por el título de la clase.
    const reservada = page.locator('.card').filter({ hasText: titulo }).first();
    await expect(reservada.getByText('Reservada')).toBeVisible();
    await expect(reservada.getByRole('link', { name: 'Ver mi reserva' })).toBeVisible();

    await page.goto('/mis-reservas');
    await expect(page.getByRole('heading', { level: 1, name: 'Mis reservas' })).toBeVisible();
    await expect(page.getByText(titulo).first()).toBeVisible();
    await expect(page.getByText('Confirmada').first()).toBeVisible();

    await page.goto('/notificaciones');
    const pendientes = page.getByRole('button', { name: 'Marcar como leída' });
    await expect(pendientes.first(), 'la reserva debió generar una notificación sin leer').toBeVisible();
    const antes = await pendientes.count();
    await pendientes.first().click();
    await expect(page.getByRole('button', { name: 'Marcar como leída' })).toHaveCount(antes - 1);
    await expect(page.getByText('Leída el').first()).toBeVisible();
  });

  test('contratar un plan deja la membresía activa', async ({ page }) => {
    await page.goto('/membresias');
    await expect(page.getByRole('heading', { level: 1, name: 'Membresías' })).toBeVisible();

    const tarjetaDelPlan = page.locator('.card', { hasText: PLAN }).first();
    await expect(tarjetaDelPlan.getByRole('heading', { name: PLAN })).toBeVisible();
    await tarjetaDelPlan.getByRole('button', { name: 'Comprar membresía' }).click();

    await expect(page.getByRole('heading', { level: 1, name: /^Pedido/ })).toBeVisible();
    await pagarConTarjetaValida(page);

    await page.goto('/mis-membresias');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi membresía' })).toBeVisible();
    await expect(page.getByText(PLAN).first()).toBeVisible();
    await expect(page.getByText('Activa', { exact: true }).first()).toBeVisible();
  });

  test('el centro de notificaciones lista el historial de la cuenta', async ({ page }) => {
    await page.goto('/notificaciones');
    await expect(page.getByRole('heading', { level: 1, name: 'Notificaciones' })).toBeVisible();
    await expect(page.locator('.list-item, .empty').first()).toBeVisible();
  });
});
