import request from 'supertest';
import {
  bearer,
  createTestContext,
  promoteTo,
  registerAccount,
  truncateAll,
  type TestContext,
} from './utils/test-context';
import { Role } from '../src/common/enums';

const CARD = {
  number: '4111 1111 1111 1111',
  holderName: 'CLIENTE PRUEBA',
  expiryMonth: 12,
  expiryYear: 2035,
  cvv: '123',
};

const daysFromNow = (days: number, hours = 0): string =>
  new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

/**
 * RF-10 (membresías) y RF-11 (reservas): compra del plan, activación tras el pago
 * aprobado, cupos, ventana de cancelación y registro de asistencia.
 */
describe('Membresías y reservas (RF-10, RF-11, RF-15)', () => {
  let context: TestContext;
  let http: TestContext['http'];
  let adminToken: string;
  let clientToken: string;
  let staffToken: string;
  let staffId: string;
  let basicPlanId: string;
  let premiumPlanId: string;

  beforeAll(async () => {
    context = await createTestContext();
    http = context.http;
    await truncateAll(context.dataSource);

    const admin = await registerAccount(http);
    await promoteTo(context.dataSource, admin.id, Role.ADMIN);
    adminToken = (
      await request(context.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: admin.email, password: admin.password })
        .expect(200)
    ).body.accessToken as string;

    const staff = await registerAccount(http);
    await promoteTo(context.dataSource, staff.id, Role.STAFF);
    staffToken = (
      await request(context.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: staff.email, password: staff.password })
        .expect(200)
    ).body.accessToken as string;
    staffId = staff.id;

    const client = await registerAccount(http);
    clientToken = client.token;

    basicPlanId = (
      await http
        .post('/api/memberships/plans')
        .set(bearer(adminToken))
        .send({
          name: 'Básico 30 días',
          description: 'acceso a sala de máquinas',
          price: 89000,
          durationDays: 30,
          accessLevel: 'BASIC',
          includesClasses: false,
        })
        .expect(201)
    ).body.id as string;

    premiumPlanId = (
      await http
        .post('/api/memberships/plans')
        .set(bearer(adminToken))
        .send({
          name: 'Premium 90 días',
          description: 'máquinas, clases grupales y evaluaciones',
          price: 219000,
          durationDays: 90,
          accessLevel: 'PREMIUM',
          includesClasses: true,
        })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    // Se limpian los datos transaccionales y los planes, pero no las cuentas:
    // los tokens de la suite siguen siendo válidos durante toda la ejecución.
    await context.dataSource.query(
      `TRUNCATE "audit_logs", "notifications", "bookings", "class_schedules", "payments",
              "order_items", "orders", "cart_items", "carts", "user_memberships", "membership_plans"
       RESTART IDENTITY CASCADE`,
    );
    basicPlanId = (
      await http
        .post('/api/memberships/plans')
        .set(bearer(adminToken))
        .send({ name: 'Básico 30 días', price: 89000, durationDays: 30, accessLevel: 'BASIC' })
        .expect(201)
    ).body.id as string;
    premiumPlanId = (
      await http
        .post('/api/memberships/plans')
        .set(bearer(adminToken))
        .send({ name: 'Premium 90 días', price: 219000, durationDays: 90, accessLevel: 'PREMIUM' })
        .expect(201)
    ).body.id as string;
  });

  it('RF-10 publica los planes disponibles con precio y duración', async () => {
    const plans = await http.get('/api/memberships/plans').expect(200);
    expect(Array.isArray(plans.body)).toBe(true);
    expect(plans.body.map((plan: { id: string }) => plan.id)).toEqual(
      expect.arrayContaining([basicPlanId, premiumPlanId]),
    );
    const basic = plans.body.find((plan: { id: string }) => plan.id === basicPlanId);
    expect(basic).toMatchObject({ price: 89000, currency: 'COP', durationDays: 30, isActive: true });
  });

  it('RF-10 comprar una membresía genera un pedido que se cobra por la misma pasarela', async () => {
    const order = await http
      .post('/api/orders/membership')
      .set(bearer(clientToken))
      .send({ planId: basicPlanId })
      .expect(201);

    expect(order.body).toMatchObject({ type: 'MEMBERSHIP', status: 'PENDING_PAYMENT', total: 89000 });
    expect(order.body.items[0].productName).toContain('Básico 30 días');

    const paid = await http
      .post('/api/payments')
      .set(bearer(clientToken))
      .send({ orderId: order.body.id, card: CARD })
      .expect(201);
    expect(paid.body.order.status).toBe('PAID');

    const active = await http.get('/api/memberships/me/active').set(bearer(clientToken)).expect(200);
    expect(active.body.planId).toBe(basicPlanId);

    const mine = await http.get('/api/memberships/me').set(bearer(clientToken)).expect(200);
    expect(mine.body[0]).toMatchObject({ status: 'ACTIVE' });
    const durationMs = new Date(mine.body[0].endDate).getTime() - new Date(mine.body[0].startDate).getTime();
    expect(Math.round(durationMs / 86_400_000)).toBe(30);
  });

  it('RF-10 la compra de una segunda membresía no solapa periodos', async () => {
    for (const planId of [basicPlanId, premiumPlanId]) {
      const order = await http
        .post('/api/orders/membership')
        .set(bearer(clientToken))
        .send({ planId })
        .expect(201);
      await http.post('/api/payments').set(bearer(clientToken)).send({ orderId: order.body.id, card: CARD }).expect(201);
    }

    const mine = await http.get('/api/memberships/me').set(bearer(clientToken)).expect(200);
    expect(mine.body).toHaveLength(2);

    // Un plan distinto inicia su propio ciclo; la vigencia que se muestra es la de mayor vencimiento.
    const byPlan = Object.fromEntries(
      (mine.body as { plan: { id: string }; startDate: string; endDate: string }[]).map((item) => [
        item.plan.id,
        item,
      ]),
    );
    expect(new Date(byPlan[basicPlanId].endDate) < new Date(byPlan[premiumPlanId].endDate)).toBe(true);

    const active = await http.get('/api/memberships/me/active').set(bearer(clientToken)).expect(200);
    expect(active.body.planId).toBe(premiumPlanId);
  });

  it('RF-10 y RNF-08 un plan inactivo no es comprable', async () => {
    await http
      .patch(`/api/memberships/plans/${basicPlanId}`)
      .set(bearer(adminToken))
      .send({ isActive: false })
      .expect(200);

    await http
      .post('/api/orders/membership')
      .set(bearer(clientToken))
      .send({ planId: basicPlanId })
      .expect(400);
  });

  it('RF-10 el cliente puede cancelar su membresía activa', async () => {
    const order = await http
      .post('/api/orders/membership')
      .set(bearer(clientToken))
      .send({ planId: premiumPlanId })
      .expect(201);
    await http.post('/api/payments').set(bearer(clientToken)).send({ orderId: order.body.id, card: CARD }).expect(201);

    const mine = await http.get('/api/memberships/me').set(bearer(clientToken)).expect(200);
    const cancelled = await http
      .patch(`/api/memberships/${mine.body[0].id}/cancel`)
      .set(bearer(clientToken))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const active = await http.get('/api/memberships/me/active').set(bearer(clientToken)).expect(200);
    expect(active.body.id).toBeUndefined();
  });

  it('RF-11 el personal crea horarios y el cliente ve el cupo disponible', async () => {
    const schedule = await http
      .post('/api/bookings/schedules')
      .set(bearer(staffToken))
      .send({
        title: 'Spinning intenso',
        startsAt: daysFromNow(3, 2),
        endsAt: daysFromNow(3, 3),
        capacity: 12,
        room: 'Sala B',
        trainerId: staffId,
      })
      .expect(201);
    expect(schedule.body.remaining).toBe(12);

    const list = await http.get('/api/bookings/schedules').set(bearer(clientToken)).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ title: 'Spinning intenso', taken: 0, remaining: 12 });
    expect(list.body.items[0].trainer).toContain('Prueba');
  });

  it('RF-11 reservar consume cupo, notifica y permite anular la reserva', async () => {
    const scheduleId = (
      await http
        .post('/api/bookings/schedules')
        .set(bearer(staffToken))
        .send({ title: 'Yoga movilidad', startsAt: daysFromNow(4, 2), endsAt: daysFromNow(4, 3), capacity: 2 })
        .expect(201)
    ).body.id as string;

    const booked = await http
      .post('/api/bookings')
      .set(bearer(clientToken))
      .send({ scheduleId })
      .expect(201);
    expect(booked.body.myBooking?.status).toBe('CONFIRMED');
    expect(booked.body.taken).toBe(1);

    const mine = await http.get('/api/bookings/me').set(bearer(clientToken)).expect(200);
    expect(mine.body[0]).toMatchObject({ title: 'Yoga movilidad', status: 'CONFIRMED' });

    const inbox = await http.get('/api/notifications').set(bearer(clientToken)).expect(200);
    expect(inbox.body.items.some((n: { event: string }) => n.event === 'BOOKING_CONFIRMED')).toBe(true);

    await http.patch(`/api/bookings/${booked.body.myBooking.id}/cancel`).set(bearer(clientToken)).expect(200);
    const afterCancel = await http.get('/api/bookings/schedules').set(bearer(clientToken)).expect(200);
    expect(afterCancel.body.items[0]).toMatchObject({ taken: 0, remaining: 2 });
  });

  it('RF-11 y RNF-08 la reserva duplicada y el aforo completo se rechazan', async () => {
    const scheduleId = (
      await http
        .post('/api/bookings/schedules')
        .set(bearer(staffToken))
        .send({ title: 'Fuerza circular', startsAt: daysFromNow(5, 2), endsAt: daysFromNow(5, 3), capacity: 1 })
        .expect(201)
    ).body.id as string;

    const first = await http.post('/api/bookings').set(bearer(clientToken)).send({ scheduleId }).expect(201);
    expect(first.body.taken).toBe(1);

    await http.post('/api/bookings').set(bearer(clientToken)).send({ scheduleId }).expect(400);

    const second = await registerAccount(http);
    await http.post('/api/bookings').set(bearer(second.token)).send({ scheduleId }).expect(400);
  });

  it('RF-11 la cancelación respeta la ventana de dos horas', async () => {
    const soonId = (
      await http
        .post('/api/bookings/schedules')
        .set(bearer(staffToken))
        .send({ title: 'Funcional exprés', startsAt: daysFromNow(0, 1), endsAt: daysFromNow(0, 2), capacity: 5 })
        .expect(201)
    ).body.id as string;

    const booking = await http.post('/api/bookings').set(bearer(clientToken)).send({ scheduleId: soonId }).expect(201);
    await http
      .patch(`/api/bookings/${booking.body.myBooking.id}/cancel`)
      .set(bearer(clientToken))
      .expect(409);

    // La reserva sigue vigente: el cupo no se liberó.
    const schedules = await http.get('/api/bookings/schedules').set(bearer(clientToken)).expect(200);
    expect(schedules.body.items.find((item: { id: string }) => item.id === soonId).taken).toBe(1);
  });

  it('RF-11 una clase que ya comenzó no es reservable', async () => {
    const past = (
      await http
        .post('/api/bookings/schedules')
        .set(bearer(staffToken))
        .send({ title: 'Clase pasada', startsAt: daysFromNow(-1), endsAt: daysFromNow(-1, 1), capacity: 5 })
        .expect(201)
    ).body.id as string;

    await http.post('/api/bookings').set(bearer(clientToken)).send({ scheduleId: past }).expect(400);
  });

  it('RF-11 el personal registra asistencia y consulta las reservas del gimnasio', async () => {
    const scheduleId = (
      await http
        .post('/api/bookings/schedules')
        .set(bearer(staffToken))
        .send({ title: 'Pilates suelo', startsAt: daysFromNow(6, 2), endsAt: daysFromNow(6, 3), capacity: 3 })
        .expect(201)
    ).body.id as string;

    const booked = await http.post('/api/bookings').set(bearer(clientToken)).send({ scheduleId }).expect(201);

    const attended = await http
      .patch(`/api/bookings/${booked.body.myBooking.id}/attendance`)
      .set(bearer(staffToken))
      .send({ status: 'ATTENDED' })
      .expect(200);
    expect(attended.body.status).toBe('ATTENDED');

    const all = await http.get('/api/bookings/all').set(bearer(staffToken)).expect(200);
    expect(all.body.items.map((item: { id: string }) => item.id)).toContain(booked.body.myBooking.id);

    await http.get('/api/bookings/all').set(bearer(clientToken)).expect(403);
  });

  it('RF-11 y RNF-01 el cliente no puede crear horarios ni un cliente puede ser instructor', async () => {
    await http
      .post('/api/bookings/schedules')
      .set(bearer(clientToken))
      .send({ title: 'Clase no autorizada', startsAt: daysFromNow(2), endsAt: daysFromNow(2, 1), capacity: 5 })
      .expect(403);

    const clientAccount = await registerAccount(http);
    await http
      .post('/api/bookings/schedules')
      .set(bearer(adminToken))
      .send({
        title: 'Con instructor inválido',
        startsAt: daysFromNow(2),
        endsAt: daysFromNow(2, 1),
        capacity: 5,
        trainerId: clientAccount.id,
      })
      .expect(400);
  });

  it('RNF-08 la capacidad no puede reducirse por debajo de las reservas activas', async () => {
    const scheduleId = (
      await http
        .post('/api/bookings/schedules')
        .set(bearer(staffToken))
        .send({ title: 'HIIT 30', startsAt: daysFromNow(7, 2), endsAt: daysFromNow(7, 3), capacity: 4 })
        .expect(201)
    ).body.id as string;

    await http.post('/api/bookings').set(bearer(clientToken)).send({ scheduleId }).expect(201);
    const other = await registerAccount(http);
    await http.post('/api/bookings').set(bearer(other.token)).send({ scheduleId }).expect(201);

    // Dos reservas activas: reducir la capacidad por debajo del aforo ocupado se rechaza.
    await http.patch(`/api/bookings/schedules/${scheduleId}`).set(bearer(staffToken)).send({ capacity: 1 }).expect(409);
    await http.patch(`/api/bookings/schedules/${scheduleId}`).set(bearer(staffToken)).send({ capacity: 2 }).expect(200);
  });

  it('RNF-09 las reservas y membresías quedan registradas en la auditoría', async () => {
    const order = await http
      .post('/api/orders/membership')
      .set(bearer(clientToken))
      .send({ planId: premiumPlanId })
      .expect(201);
    await http.post('/api/payments').set(bearer(clientToken)).send({ orderId: order.body.id, card: CARD }).expect(201);

    const scheduleId = (
      await http
        .post('/api/bookings/schedules')
        .set(bearer(staffToken))
        .send({ title: 'Movilidad articular', startsAt: daysFromNow(8, 2), endsAt: daysFromNow(8, 3), capacity: 6 })
        .expect(201)
    ).body.id as string;
    await http.post('/api/bookings').set(bearer(clientToken)).send({ scheduleId }).expect(201);

    const audit = (await http.get('/api/admin/audit').set(bearer(adminToken)).expect(200)).body as {
      action: string;
    }[];
    const actions = audit.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['MEMBERSHIP_ORDER_CREATED', 'ORDER_PAID', 'BOOKING_CREATED']),
    );
  });

  it('RF-14 el dashboard refleja la membresía activa y las reservas próximas', async () => {
    const order = await http
      .post('/api/orders/membership')
      .set(bearer(clientToken))
      .send({ planId: basicPlanId })
      .expect(201);
    await http.post('/api/payments').set(bearer(clientToken)).send({ orderId: order.body.id, card: CARD }).expect(201);

    await http
      .post('/api/bookings/schedules')
      .set(bearer(staffToken))
      .send({ title: 'Ciclismo indoor', startsAt: daysFromNow(9, 2), endsAt: daysFromNow(9, 3), capacity: 8 })
      .expect(201);

    const dashboard = await http.get('/api/admin/dashboard').set(bearer(adminToken)).expect(200);
    expect(dashboard.body.memberships.active).toBe(1);
    expect(dashboard.body.bookings.upcomingConfirmed).toBe(0);
    expect(dashboard.body.topProducts[0].productName).toContain('Básico 30 días');
  });
});
