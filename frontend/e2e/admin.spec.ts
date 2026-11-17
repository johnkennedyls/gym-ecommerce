import { expect, test } from '@playwright/test';

const PLAN = 'Mensual Básico';

/**
 * RF-10 a RF-15 y RNF-01/RNF-09 desde el rol administrador.
 * Corre con la sesión guardada de admin; ninguna prueba escribe en la base de la suite de cliente.
 */
test.describe('panel de administración', () => {
  test('el tablero resume ventas, pedidos e inventario crítico', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Panel de control' })).toBeVisible();

    for (const etiqueta of [
      'Ventas del periodo',
      'Pedidos pagados',
      'Ticket promedio',
      'Membresías activas',
      'Productos activos',
    ]) {
      await expect(page.getByText(etiqueta, { exact: true })).toBeVisible();
    }

    // La botella térmica se siembra con stock cero: siempre debe aparecer en el aviso de existencias.
    await expect(page.getByText('SKU ACC-BOTTLE-1L')).toBeVisible();
  });

  test('las pestañas del panel cargan cada superficie', async ({ page }) => {
    const esperadas: [string, string][] = [
      ['/admin/productos', 'Productos y categorías'],
      ['/admin/pedidos', 'Pedidos'],
      ['/admin/usuarios', 'Usuarios y roles'],
      ['/admin/planes', 'Planes de membresía'],
      ['/admin/horarios', 'Horarios de clases'],
      ['/admin/reservas', 'Reservas y asistencia'],
      ['/admin/auditoria', 'Bitácora de auditoría'],
    ];

    for (const [ruta, titulo] of esperadas) {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    }
  });

  test('el inventario busca por SKU y vuelve a la vista completa', async ({ page }) => {
    await page.goto('/admin/productos');
    await page.getByLabel('Buscar').fill('SUP-CREA');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText('Creatina monohidratada 300 g')).toBeVisible();
    await expect(page.getByText('Proteína whey 900 g')).toHaveCount(0);

    await page.getByRole('button', { name: 'Limpiar' }).click();
    await expect(page.getByText('Proteína whey 900 g')).toBeVisible();
  });

  test('el formulario de producto se abre y se cancela sin escribir datos', async ({ page }) => {
    await page.goto('/admin/productos');
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear producto' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('la agenda de usuarios filtra por correo', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await expect(page.getByRole('columnheader', { name: 'Correo' })).toBeVisible();

    await page.getByLabel('Buscar').fill('admin@gymsoftware.test');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText('admin@gymsoftware.test')).toBeVisible();
    await expect(page.getByText('staff@gymsoftware.test')).toHaveCount(0);
  });

  test('los pedidos se filtran por estado', async ({ page }) => {
    await page.goto('/admin/pedidos');
    const filas = page.locator('tbody tr');

    await page.getByLabel('Estado').selectOption('PAID');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.locator('tbody').getByText('Pagado').first()).toBeVisible();
    await expect(filas.filter({ hasNotText: 'Pagado' })).toHaveCount(0);

    await page.getByLabel('Estado').selectOption('CANCELLED');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(filas.filter({ hasNotText: 'Cancelado' })).toHaveCount(0);
  });

  test('la pantalla de planes lista los niveles sembrados', async ({ page }) => {
    await page.goto('/admin/planes');
    await expect(page.getByRole('columnheader', { name: 'Precio' })).toBeVisible();
    await expect(page.getByText(PLAN).first()).toBeVisible();
    await expect(page.getByText('Anual Atleta').first()).toBeVisible();
  });
});
