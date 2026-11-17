import './setup-env';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Role } from '../../src/common/enums';
import { User } from '../../src/modules/users/entities/user.entity';


export type TestContext = {
  app: INestApplication;
  http: ReturnType<typeof request>;
  dataSource: DataSource;
};

export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  // Se replica la configuración de seguridad del arranque real (RNF-01, OWASP A05).
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  const dataSource = app.get(DataSource);
  return { app, http: request(app.getHttpServer()), dataSource };
}

const TABLES = [
  'audit_logs',
  'notifications',
  'bookings',
  'class_schedules',
  'payments',
  'order_items',
  'orders',
  'cart_items',
  'carts',
  'user_memberships',
  'membership_plans',
  'stock_movements',
  'products',
  'categories',
  'password_reset_tokens',
  'refresh_tokens',
  'users',
];

/** Deja la base de datos de pruebas vacía antes de cada suite (ISO/IEC/IEEE 29119 condiciones de prueba). */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

export type Account = {
  email: string;
  password: string;
  token: string;
  refreshToken: string;
  id: string;
};

export async function registerAccount(
  http: TestContext['http'],
  seed: { firstName?: string; lastName?: string } = {},
): Promise<Account> {
  const email = `cliente-${Math.random().toString(36).slice(2, 10)}@gymsoftware.test`;
  const password = 'Clave1234';

  const created = await http
    .post('/api/auth/register')
    .send({
      firstName: seed.firstName ?? 'Prueba',
      lastName: seed.lastName ?? 'GymSoftware',
      email,
      password,
      phone: '+573001112233',
    })
    .expect(201);

  const session = created.body as { accessToken: string; refreshToken: string; user: { id: string } };
  return {
    email,
    password,
    token: session.accessToken,
    refreshToken: session.refreshToken,
    id: session.user.id,
  };
}

/** Eleva el rol directamente en datos: el registro público siempre crea clientes. */
export async function promoteTo(
  dataSource: DataSource,
  accountId: string,
  role: Role.ADMIN | Role.STAFF,
): Promise<void> {
  await dataSource.getRepository(User).update({ id: accountId }, { role });
}

export const hashForTests = (value: string): Promise<string> => bcrypt.hash(value, 4);

export const bearer = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });
