import { expect, test, type Page } from '@playwright/test';

const WHEY = 'Proteína whey 900 g';

async function pagarTarjeta(page: Page, numero: string): Promise<void> {
  await page.getByLabel('Número de tarjeta').fill(numero);
  await page.getByLabel('Titular').fill('CLIENTE DEMO');
  await page.getByLabel('Mes').fill('12');
  await page.getByLabel('Año').fill(String(new Date().getFullYear() + 2));
  await page.getByLabel('CVV').fill('123');
  await page.getByRole('button', { name: /^Pagar/ }).click();
}

/** Deja el carrito vacío desde la propia interfaz, aceptando la confirmación nativa. */
async function vaciarCarrito(page: Page): Promise<void> {
  await page.goto('/carrito');
  const vaciar = page.getByRole('button', { name: 'Vaciar carrito' });
  if (await vaciar.isVisible()) {
    page.once('dialog', (dialog) => void dialog.accept());
    await vaciar.click();
    await expect(page.getByRole('button', { name: 'Vaciar carrito' })).toHaveCount(0);
  }
}

/**
 * RF-05 a RF-09: ficha de producto, carrito, pedido y pasarela de pruebas.
 * Usa la sesión guardada de cliente para no repetir inicios de sesión en cada corrida.
 */
test.describe('compra con pasarela de pruebas', () => {
  test('un artículo agotado no se puede agregar desde la ficha', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Botella térmica 1 L' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Botella térmica 1 L' })).toBeVisible();
    await expect(page.getByText('Agotado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeDisabled();
  });

  test('el rechazo de la pasarela permite reintentar hasta aprobar el pago', async ({ page }) => {
    await vaciarCarrito(page);

    await page.goto('/');
    await page.locator('article.card', { hasText: WHEY }).getByRole('button', { name: 'Agregar' }).click();
    await page.getByRole('link', { name: /^Carrito/ }).click();
    await expect(page.getByRole('heading', { name: 'Tu carrito' })).toBeVisible();
    await page.getByRole('button', { name: `Sumar una unidad de ${WHEY}` }).click();
    await expect(page.getByRole('link', { name: WHEY })).toBeVisible();
    await page.getByRole('link', { name: 'Finalizar compra' }).click();

    await expect(page.getByRole('heading', { name: 'Datos de entrega' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar al pago' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Pago del pedido/ })).toBeVisible();

    // Primer intento con la tarjeta de rechazo del sandbox (termina en 0002).
    await pagarTarjeta(page, '4000 0000 0000 0002');
    await expect(page.getByText('La pasarela rechazó la transacción')).toBeVisible();

    // Segundo intento con la tarjeta válida: clave de idempotencia nueva por intento.
    await pagarTarjeta(page, '4242 4242 4242 4242');
    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{30,}/);
    await expect(page.getByRole('heading', { level: 1, name: /^Pedido/ })).toBeVisible();
    await expect(page.getByText('Pagado').first()).toBeVisible();
    await expect(page.getByText('Aprobado').first()).toBeVisible();
  });

  test('un carrito vacío no abre la pasarela', async ({ page }) => {
    await vaciarCarrito(page);
    await page.goto('/pago');
    await expect(page.getByRole('heading', { name: 'No hay nada que pagar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar al pago' })).toHaveCount(0);
  });
});
