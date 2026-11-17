import { truncateAll, bearer, createTestContext, TestContext, registerAccount } from './utils/test-context';

describe('Autenticación y perfiles (RF-01, RF-02, RF-03)', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    await truncateAll(context.dataSource);
  });

  afterAll(async () => context.app.close());

  it('registra un cliente, crea su sesión y deja evidencia de trazabilidad', async () => {
    const account = await registerAccount(context.http);

    expect(account.token).toBeTruthy();
    const logs = await context.dataSource.query(
      `SELECT action FROM audit_logs WHERE user_id = $1 ORDER BY created_at`,
      [account.id],
    );
    expect(logs.map((log: { action: string }) => log.action)).toContain('USER_REGISTERED');
  });

  it('rechaza contraseñas débiles y correos duplicados (RNF-01, OWASP A07)', async () => {
    await context.http
      .post('/api/auth/register')
      .send({
        firstName: 'Débil',
        lastName: 'Clave',
        email: `debil-${Date.now()}@gymsoftware.test`,
        password: 'abc123',
      })
      .expect(400);

    const account = await registerAccount(context.http);
    await context.http
      .post('/api/auth/register')
      .send({
        firstName: 'Otro',
        lastName: 'Perfil',
        email: account.email,
        password: 'OtraClave1234',
      })
      .expect(401);
  });

  it('inicia sesión con credenciales válidas y rechaza las incorrectas sin revelar el motivo', async () => {
    const account = await registerAccount(context.http);

    const ok = await context.http
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);
    expect(ok.body.user.email).toBe(account.email);
    expect(ok.body.user).not.toHaveProperty('passwordHash');

    await context.http
      .post('/api/auth/login')
      .send({ email: account.email, password: 'ClaveErrada1234' })
      .expect(401);
  });

  it('protege las rutas privadas y permite cerrar sesión (RNF-01)', async () => {
    const account = await registerAccount(context.http);

    await context.http.get('/api/users/me').expect(401);
    const me = await context.http.get('/api/users/me').set(bearer(account.token)).expect(200);
    expect(me.body.id).toBe(account.id);

    await context.http.post('/api/auth/logout').send({ refreshToken: account.refreshToken }).expect(204);
    await context.http.post('/api/auth/refresh').send({ refreshToken: account.refreshToken }).expect(401);
  });

  it('rota el token de refresco en cada renovación', async () => {
    const account = await registerAccount(context.http);

    const renewed = await context.http
      .post('/api/auth/refresh')
      .send({ refreshToken: account.refreshToken })
      .expect(200);
    expect(renewed.body.refreshToken).not.toBe(account.refreshToken);

    await context.http
      .post('/api/auth/refresh')
      .send({ refreshToken: account.refreshToken })
      .expect(401);
  });

  it('permite actualizar el perfil y cambiar la contraseña', async () => {
    const account = await registerAccount(context.http);

    const updated = await context.http
      .patch('/api/users/me')
      .set(bearer(account.token))
      .send({ firstName: 'Nombre', lastName: 'Actualizado', birthDate: '1995-04-12' })
      .expect(200);
    expect(updated.body.firstName).toBe('Nombre');

    await context.http
      .post('/api/auth/change-password')
      .set(bearer(account.token))
      .send({ currentPassword: account.password, newPassword: 'NuevaClave1234' })
      .expect(200);

    await context.http
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(401);

    const relogin = await context.http
      .post('/api/auth/login')
      .send({ email: account.email, password: 'NuevaClave1234' })
      .expect(200);
    expect(relogin.body.accessToken).toBeTruthy();
  });

  it('no acepta campos no declarados en el registro (validación de entradas)', async () => {
    await context.http
      .post('/api/auth/register')
      .send({
        firstName: 'Con',
        lastName: 'Rol',
        email: `rol-${Date.now()}@gymsoftware.test`,
        password: 'Clave1234',
        role: 'ADMIN',
      })
      .expect(400);
  });

  it('recupera la contraseña mediante token de un solo uso (anti enumeración)', async () => {
    const account = await registerAccount(context.http);

    const unknown = await context.http
      .post('/api/auth/forgot-password')
      .send({ email: 'no-existe@gymsoftware.test' })
      .expect(200);

    const forgot = await context.http
      .post('/api/auth/forgot-password')
      .send({ email: account.email })
      .expect(200);

    // La respuesta es idéntica exista o no la cuenta: no se revela el registro (OWASP A01/A07).
    expect(forgot.body.message).toBe(unknown.body.message);

    const rows = await context.dataSource.query(
      `SELECT body FROM notifications WHERE user_id = $1 AND event = 'PASSWORD_RESET'`,
      [account.id],
    );
    expect(rows).toHaveLength(1);
    const token = /token=([0-9a-f]{32,})/.exec(rows[0].body as string)?.[1];
    expect(token).toBeTruthy();

    await context.http
      .post('/api/auth/reset-password')
      .send({ token: 'token-invalido', newPassword: 'OtraClave1234' })
      .expect(401);

    await context.http
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NuevaClave1234' })
      .expect(200);

    await context.http
      .post('/api/auth/login')
      .send({ email: account.email, password: 'NuevaClave1234' })
      .expect(200);

    // El token es de un solo uso y las sesiones anteriores quedaron revocadas.
    await context.http
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'OtraClave1234' })
      .expect(401);

    await context.http
      .post('/api/auth/refresh')
      .send({ refreshToken: account.refreshToken })
      .expect(401);
  });
});
