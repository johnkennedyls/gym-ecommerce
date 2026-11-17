import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  TestContext,
  bearer,
  createTestContext,
  promoteTo,
  registerAccount,
  truncateAll,
} from './utils/test-context';
import { Role } from '../src/common/enums';

/**
 * Pruebas end-to-end del flujo comercial completo (ISO/IEC/IEEE 29119, nivel de
 * sistema): catálogo → carrito → checkout → pasarela → pedido → inventario →
 * notificaciones → trazabilidad.
 * Cubren RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-13, RF-14, RF-15,
 * RNF-01, RNF-08 y RNF-09.
 */
describe('Flujo comercial de compra (RF-04 a RF-09, RF-13, RF-15)', () => {
  let context: TestContext;
  let app: INestApplication;
  let http: TestContext['http'];

  let adminToken: string;
  let clientToken: string;
  let categoryId: string;
  let proteinId: string;
  let bottleId: string;
  let trainingServiceId: string;

  const CARD_OK = {
    number: '4111 1111 1111 1111',
    holderName: 'CLIENTE PRUEBA',
    expiryMonth: 12,
    expiryYear: 2035,
    cvv: '123',
  };

  const CARD_DECLINED = { ...CARD_OK, number: '4000 0000 0000 0002' };
  const CARD_INVALID_LUHN = { ...CARD_OK, number: '1234 5678 1234 5678' };

  const createProduct = (payload: Record<string, unknown>) =>
    http.post('/api/catalog/products').set(bearer(adminToken)).send(payload).expect(201);

  beforeAll(async () => {
    context = await createTestContext();
    app = context.app;
    http = context.http;
    await truncateAll(context.dataSource);

    const admin = await registerAccount(http);
    await promoteTo(context.dataSource, admin.id, Role.ADMIN);
    const adminLogin = await http
      .post('/api/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    adminToken = adminLogin.body.accessToken as string;

    const client = await registerAccount(http);
    clientToken = client.token;

    const category = await http
      .post('/api/catalog/categories')
      .set(bearer(adminToken))
      .send({ name: 'Suplementación', description: 'Proteínas y recoveredores' })
      .expect(201);
    categoryId = category.body.id as string;

    proteinId = (
      await createProduct({
        name: 'Proteína Whey 1kg',
        sku: 'PRO-WHEY-1KG',
        description: 'Proteína de suero con 24 g por porción',
        price: 129900,
        kind: 'PRODUCT',
        stock: 10,
        categoryId,
      })
    ).body.id as string;

    bottleId = (
      await createProduct({
        name: 'Botella 1L',
        sku: 'ACC-BOTTLE-1L',
        price: 25000,
        kind: 'PRODUCT',
        stock: 0,
        categoryId,
      })
    ).body.id as string;

    trainingServiceId = (
      await createProduct({
        name: 'Entrenamiento personal 60 min',
        sku: 'SRV-PT-60',
        price: 60000,
        kind: 'SERVICE',
        durationMinutes: 60,
        categoryId,
      })
    ).body.id as string;
  });

  afterAll(async () => {
    if (context) {
      await truncateAll(context.dataSource);
      await context.app.close();
    }
  });

  beforeEach(async () => {
    await truncateAllExceptKeepCatalog();
  });

  /** Vacía los datos transaccionales para aislar cada caso de prueba. */
  async function truncateAllExceptKeepCatalog(): Promise<void> {
    const tables = [
      'audit_logs',
      'notifications',
      'bookings',
      'payments',
      'order_items',
      'orders',
      'cart_items',
      'carts',
      'stock_movements',
      'user_memberships',
    ];
    await context.dataSource.query(
      `TRUNCATE ${tables.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
    await context.dataSource.query(
      `UPDATE products SET stock = CASE sku WHEN 'PRO-WHEY-1KG' THEN 10 WHEN 'ACC-BOTTLE-1L' THEN 0 ELSE stock END, is_active = true`,
    );
  }

  it('RF-04 expone el catálogo público con precio, disponibilidad y categoría', async () => {
    const response = await http.get('/api/catalog/products').expect(200);

    expect(response.body.items).toHaveLength(3);
    const protein = response.body.items.find((item: { sku: string }) => item.sku === 'PRO-WHEY-1KG');
    expect(protein).toMatchObject({
      price: 129900,
      currency: 'COP',
      kind: 'PRODUCT',
      stock: 10,
      available: true,
      category: { name: 'Suplementación' },
    });

    const bottle = response.body.items.find((item: { sku: string }) => item.sku === 'ACC-BOTTLE-1L');
    expect(bottle.available).toBe(false);
  });

  it('RF-05 filtra por búsqueda, rango de precio, tipo y disponibilidad', async () => {
    const bySearch = await http
      .get('/api/catalog/products')
      .query({ search: 'proteína' })
      .expect(200);
    expect(bySearch.body.items.map((item: { sku: string }) => item.sku)).toEqual(['PRO-WHEY-1KG']);

    const byPrice = await http
      .get('/api/catalog/products')
      .query({ minPrice: 50000, maxPrice: 100000, sortBy: 'price_asc' })
      .expect(200);
    expect(byPrice.body.items.map((item: { sku: string }) => item.sku)).toEqual(['SRV-PT-60']);

    const servicesOnly = await http.get('/api/catalog/products').query({ kind: 'SERVICE' }).expect(200);
    expect(servicesOnly.body.total).toBe(1);

    const availableOnly = await http
      .get('/api/catalog/products')
      .query({ availableOnly: 'true' })
      .expect(200);
    expect(availableOnly.body.items).toHaveLength(2);
  });

  it('RF-06 agrega, modifica y elimina elementos del carrito con totales exactos', async () => {
    const added = await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 2 })
      .expect(201);
    expect(added.body.totals).toMatchObject({ subtotal: 259800, total: 259800 });

    const itemId = added.body.items[0].id as string;
    const updated = await http
      .patch(`/api/cart/items/${itemId}`)
      .set(bearer(clientToken))
      .send({ quantity: 3 })
      .expect(200);
    expect(updated.body.totals.total).toBe(389700);

    const withService = await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: trainingServiceId, quantity: 1 })
      .expect(201);
    expect(withService.body.items).toHaveLength(2);
    expect(withService.body.totals.total).toBe(449700);

    const removed = await http
      .delete(`/api/cart/items/${itemId}`)
      .set(bearer(clientToken))
      .expect(200);
    expect(removed.body.items).toHaveLength(1);

    await http.delete('/api/cart').set(bearer(clientToken)).expect(200);
    const empty = await http.get('/api/cart').set(bearer(clientToken)).expect(200);
    expect(empty.body.items).toHaveLength(0);
  });

  it('RNF-01 y RF-06 rechazan cantidades sin inventario y rutas no autenticadas', async () => {
    await http.get('/api/cart').expect(401);

    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: bottleId, quantity: 1 })
      .expect(400);

    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 11 })
      .expect(400);
  });

  it('RF-07 y RF-08 completar el carrito, pagar con tarjeta aprobada y cerrar el pedido', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 2 })
      .expect(201);

    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);

    expect(order.body).toMatchObject({
      status: 'PENDING_PAYMENT',
      statusLabel: 'pendiente de pago',
      total: 259800,
      currency: 'COP',
    });
    expect(order.body.code).toMatch(/^O-\d{6}-[0-9A-F]{6}$/);

    const cartAfterCheckout = await http.get('/api/cart').set(bearer(clientToken)).expect(200);
    expect(cartAfterCheckout.body.items).toHaveLength(0);

    const paid = await http
      .post('/api/payments')
      .set(bearer(clientToken))
      .send({ orderId: order.body.id, card: CARD_OK })
      .expect(201);

    expect(paid.body.payment).toMatchObject({
      status: 'APPROVED',
      amount: 259800,
      gateway: 'SANDBOX',
      cardLast4: '1111',
    });
    expect(paid.body.payment.reference).toMatch(/^SBX-/);
    expect(paid.body.order.status).toBe('PAID');

    const product = await http.get(`/api/catalog/products/${proteinId}`).expect(200);
    expect(product.body.stock).toBe(8);

    const inbox = await http.get('/api/notifications').set(bearer(clientToken)).expect(200);
    const events = inbox.body.items.map((item: { event: string }) => item.event);
    expect(events).toEqual(expect.arrayContaining(['ORDER_CREATED', 'PAYMENT_APPROVED']));
  });

  it('RNF-10 nunca persiste el número completo de la tarjeta', async () => {
    await http.post('/api/cart/items').set(bearer(clientToken)).send({ productId: proteinId, quantity: 1 }).expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);
    await http.post('/api/payments').set(bearer(clientToken)).send({ orderId: order.body.id, card: CARD_OK }).expect(201);

    const rows = await context.dataSource.query(
      `SELECT gateway_reference, card_last4 FROM payments`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].card_last4).toBe('1111');

    const stored = JSON.stringify(rows);
    expect(stored).not.toContain('4111111111111111');
  });

  it('RF-08 rechaza una tarjeta vencida o sin validez y mantiene el pedido pendiente', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: trainingServiceId, quantity: 1 })
      .expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);

    const declined = await http
      .post('/api/payments')
      .set(bearer(clientToken))
      .send({ orderId: order.body.id, card: CARD_DECLINED })
      .expect(201);
    expect(declined.body.payment.status).toBe('DECLINED');
    expect(declined.body.order.status).toBe('PENDING_PAYMENT');

    const invalid = await http
      .post('/api/payments')
      .set(bearer(clientToken))
      .send({ orderId: order.body.id, card: CARD_INVALID_LUHN })
      .expect(201);
    expect(invalid.body.payment.status).toBe('ERROR');

    const inbox = await http.get('/api/notifications').set(bearer(clientToken)).expect(200);
    expect(inbox.body.items.some((item: { event: string }) => item.event === 'PAYMENT_DECLINED')).toBe(true);
  });

  it('RNF-08 la reintentada con la misma clave de idempotencia no descuenta stock dos veces', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 1 })
      .expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Carrera 8 #12-45', receiverName: 'Cliente Prueba' })
      .expect(201);

    const payload = { orderId: order.body.id, card: CARD_OK, idempotencyKey: 'clave-unica-001' };
    const first = await http.post('/api/payments').set(bearer(clientToken)).send(payload).expect(201);
    expect(first.body.order.status).toBe('PAID');

    const stockAfterFirst = (await http.get(`/api/catalog/products/${proteinId}`).expect(200)).body.stock;

    const second = await http.post('/api/payments').set(bearer(clientToken)).send(payload).expect(201);
    expect(second.body.payment.id).toBe(first.body.payment.id);

    const stockAfterRetry = (await http.get(`/api/catalog/products/${proteinId}`).expect(200)).body.stock;
    expect(stockAfterRetry).toBe(stockAfterFirst);

    await http
      .post('/api/payments')
      .set(bearer(clientToken))
      .send({ orderId: order.body.id, card: CARD_OK })
      .expect(400);
  });

  it('RF-09 el cliente consulta su historial y no puede leer pedidos de otra cuenta', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 1 })
      .expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);

    const history = await http.get('/api/orders').set(bearer(clientToken)).expect(200);
    expect(history.body.items.map((item: { id: string }) => item.id)).toContain(order.body.id);

    const stranger = await registerAccount(http);
    await http
      .get(`/api/orders/${order.body.id}`)
      .set(bearer(stranger.token))
      .expect(404);
  });

  it('RF-13 el ajuste manual de inventario queda trazado en los movimientos', async () => {
    const adjusted = await http
      .post(`/api/catalog/products/${proteinId}/stock`)
      .set(bearer(adminToken))
      .send({ quantity: 5, note: 'Ingreso de proveedor' })
      .expect(201);
    expect(adjusted.body.stock).toBe(15);

    const movements = await http
      .get(`/api/catalog/products/${proteinId}/movements`)
      .set(bearer(adminToken))
      .expect(200);
    expect((movements.body as unknown as Record<string, unknown>[])[0]).toMatchObject({
      type: 'ADJUSTMENT_IN',
      quantity: 5,
    });

    await http
      .post(`/api/catalog/products/${bottleId}/stock`)
      .set(bearer(adminToken))
      .send({ quantity: -1 })
      .expect(400);
  });

  it('RF-15 y RNF-09 la bandeja de no leídas y la auditoría reflejan la operación', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 1 })
      .expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);
    await http
      .post('/api/payments')
      .set(bearer(clientToken))
      .send({ orderId: order.body.id, card: CARD_OK })
      .expect(201);

    const inbox = await http.get('/api/notifications').set(bearer(clientToken)).expect(200);
    const unreadBefore = inbox.body.unread as number;
    expect(unreadBefore).toBeGreaterThan(0);

    const first = inbox.body.items[0] as { id: string };
    await http.patch(`/api/notifications/${first.id}/read`).set(bearer(clientToken)).expect(200);
    const afterRead = await http.get('/api/notifications').set(bearer(clientToken)).expect(200);
    expect(afterRead.body.unread).toBe(unreadBefore - 1);

    const audit = await http.get('/api/admin/audit').set(bearer(adminToken)).expect(200);
    const actions = (audit.body as { action: string }[]).map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['ORDER_CREATED', 'PAYMENT_APPROVED', 'ORDER_PAID']),
    );
  });

  it('RF-14 el panel administrativo consolida ventas, inventario y usuarios', async () => {
    const dashboard = await http.get('/api/admin/dashboard').set(bearer(adminToken)).expect(200);

    expect(dashboard.body.sales).toMatchObject({ revenue: expect.any(Number), paidOrders: expect.any(Number) });
    expect(dashboard.body.inventory).toHaveProperty('lowStock');
    expect(dashboard.body.usersByRole).toHaveProperty('ADMIN');
    expect(dashboard.body.sales.averageTicket).toBeGreaterThanOrEqual(0);
    expect(dashboard.body.ordersByStatus).toBeDefined();
  });

  it('RF-12 y RNF-01 un administrador puede desactivar un artículo y desaparece del catálogo', async () => {
    await http
      .patch(`/api/catalog/products/${trainingServiceId}`)
      .set(bearer(adminToken))
      .send({ isActive: false })
      .expect(200);

    const publicList = await http.get('/api/catalog/products').expect(200);
    expect(publicList.body.items.map((item: { sku: string }) => item.sku)).not.toContain('SRV-PT-60');

    const withInactive = await http
      .get('/api/catalog/products')
      .query({ includeInactive: 'true' })
      .set(bearer(adminToken))
      .expect(200);
    expect(withInactive.body.items.map((item: { sku: string }) => item.sku)).toContain('SRV-PT-60');
  });

  it('el cliente no puede administrar el catálogo (control de acceso OWASP A01)', async () => {
    await http
      .post('/api/catalog/products')
      .set(bearer(clientToken))
      .send({
        name: 'Producto no autorizado',
        sku: 'NO-AUTH-01',
        price: 1000,
        kind: 'PRODUCT',
        stock: 1,
        categoryId,
      })
      .expect(403);

    await http.patch(`/api/catalog/products/${proteinId}`).set(bearer(clientToken)).send({ price: 1 }).expect(403);
  });

  it('RF-07 no permite checkout con carrito vacío ni direcciones incompletas', async () => {
    await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30', receiverName: 'Cliente' })
      .expect(400);

    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 1 })
      .expect(201);

    await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'cor', receiverName: 'Cliente Prueba' })
      .expect(400);
  });

  it('RF-09 la cancelación de un pedido pagado devuelve el inventario', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 2 })
      .expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);
    await http
      .post('/api/payments')
      .set(bearer(clientToken))
      .send({ orderId: order.body.id, card: CARD_OK })
      .expect(201);

    const stockBeforeCancel = (await http.get(`/api/catalog/products/${proteinId}`).expect(200)).body.stock;

    const cancelled = await http
      .patch(`/api/orders/${order.body.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'CANCELLED', note: 'Solicitud del cliente' })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const stockAfterCancel = (await http.get(`/api/catalog/products/${proteinId}`).expect(200)).body.stock;
    expect(stockAfterCancel).toBe(stockBeforeCancel + 2);

    await http
      .patch(`/api/orders/${order.body.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'SHIPPED' })
      .expect(400);
  });

  it('un pedido no puede saltar de pendiente de pago a completado', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 1 })
      .expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);

    await http
      .patch(`/api/orders/${order.body.id}/status`)
      .set(bearer(adminToken))
      .send({ status: 'COMPLETED' })
      .expect(400);
  });

  it('RF-09 el pedido solo es legible por su dueño o un administrador', async () => {
    await http
      .post('/api/cart/items')
      .set(bearer(clientToken))
      .send({ productId: proteinId, quantity: 1 })
      .expect(201);
    const order = await http
      .post('/api/orders/checkout')
      .set(bearer(clientToken))
      .send({ shippingAddress: 'Calle 5 #2-30, Popayán', receiverName: 'Cliente Prueba' })
      .expect(201);

    const adminView = await http
      .get(`/api/orders/${order.body.id}`)
      .set(bearer(adminToken))
      .expect(200);
    expect(adminView.body.id).toBe(order.body.id);

    const adminList = await http.get('/api/orders/admin').set(bearer(adminToken)).expect(200);
    expect(adminList.body.items.map((item: { id: string }) => item.id)).toContain(order.body.id);

    await http.get('/api/orders/admin').set(bearer(clientToken)).expect(403);
  });
});
