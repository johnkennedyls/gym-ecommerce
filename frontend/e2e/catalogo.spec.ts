import { expect, test } from '@playwright/test';

/**
 * RF-01 a RF-04 vistas desde la tienda pública: catálogo, filtros y disponibilidad de stock.
 * No requiere sesión; los botones de compra dirigen al registro.
 */
test.describe('catálogo público', () => {
  test('muestra los artículos sembrados con su precio', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Todo tu gimnasio, en un solo carrito' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
    await expect(page.locator('.grid-cards article')).toHaveCount(8);
    await expect(page.getByRole('link', { name: 'Proteína whey 900 g' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Creatina monohidratada/ })).toBeVisible();
  });

  test('un artículo agotado no se puede agregar al carrito', async ({ page }) => {
    await page.goto('/');
    const agotado = page.locator('article.card', { hasText: 'Botella térmica 1 L' });
    await expect(agotado.getByText('Agotado')).toBeVisible();
    await expect(agotado.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  test('la búsqueda deja constancia en la URL y reduce el resultado', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Buscar').fill('whey');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page).toHaveURL(/search=whey/);
    await expect(page.locator('.grid-cards article')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Proteína whey 900 g' })).toBeVisible();

    await page.getByRole('button', { name: 'Limpiar' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.grid-cards article')).toHaveCount(8);
  });

  test('el orden por precio sube el más barato al primer puesto', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Ordenar por').selectOption('price_asc');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.locator('.grid-cards article').first()).toContainText('Botella térmica 1 L');
  });

  test('agregar sin sesión dirige al login', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('article.card', { hasText: 'Proteína whey 900 g' })
      .getByRole('button', { name: 'Agregar' })
      .click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeVisible();
  });
});
