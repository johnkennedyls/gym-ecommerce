import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { appDataSource } from './data-source';
import { Role, MembershipLevel, ProductKind } from '../common/enums';
import { User } from '../modules/users/entities/user.entity';
import { Category } from '../modules/catalog/entities/category.entity';
import { Product } from '../modules/catalog/entities/product.entity';
import { MembershipPlan } from '../modules/memberships/entities/membership-plan.entity';
import { ClassSchedule } from '../modules/bookings/entities/class-schedule.entity';

const day = 86_400_000;

const CATEGORIES = [
  { name: 'Suplementación', slug: 'suplementacion', description: 'Proteínas, creatina y recuperadores' },
  { name: 'Indumentaria', slug: 'indumentaria', description: 'Ropa y calzado de entrenamiento' },
  { name: 'Accesorios', slug: 'accesorios', description: 'Bandas, guantes, botellas y colchonetas' },
  { name: 'Servicios de entrenamiento', slug: 'servicios', description: 'Planes guiados y asesorías' },
];

const PRODUCTS = [
  { sku: 'SUP-WHEY-900', name: 'Proteína whey 900 g', price: 189_900, stock: 24, category: 'suplementacion', description: 'Concentrado de proteína de suero, 24 porciones.', imageUrl: '/img/sup-whey.jpg' },
  { sku: 'SUP-CREA-300', name: 'Creatina monohidratada 300 g', price: 96_500, stock: 15, category: 'suplementacion', description: 'Creatina micronizada sin sabor.', imageUrl: '/img/sup-crea.jpg' },
  { sku: 'IND-CAM-DRY', name: 'Camiseta dry-fit', price: 54_900, stock: 40, category: 'indumentaria', description: 'Tejido transpirable de entrenamiento.', imageUrl: '/img/ind-cam.jpg' },
  { sku: 'IND-SHOE-TRN', name: 'Zapatillas de entrenamiento', price: 289_000, stock: 8, category: 'indumentaria', description: 'Suela plana para fuerza y funcional.', imageUrl: '/img/ind-shoe.jpg' },
  { sku: 'ACC-BAND-SET', name: 'Set de bandas elásticas', price: 78_000, stock: 3, category: 'accesorios', description: 'Cinco niveles de resistencia.', imageUrl: '/img/acc-band.jpg' },
  { sku: 'ACC-BOTTLE-1L', name: 'Botella térmica 1 L', price: 42_500, stock: 0, category: 'accesorios', description: 'Mantiene la temperatura 12 horas.', imageUrl: '/img/acc-bottle.jpg' },
  { sku: 'SRV-PT-4', name: 'Cuatro sesiones de entrenador personal', price: 240_000, category: 'servicios', kind: ProductKind.SERVICE, durationMinutes: 60, description: 'Sesiones presenciales de una hora con evaluador certificado.' },
  { sku: 'SRV-ASSESS', name: 'Evaluación física completa', price: 65_000, category: 'servicios', kind: ProductKind.SERVICE, durationMinutes: 45, description: 'Composición corporal, movilidad y plan de trabajo.' },
];

const PLANS = [
  { name: 'Mensual Básico', price: 89_000, durationDays: 30, level: MembershipLevel.BASIC, includes: false, description: 'Acceso a sala de máquinas en horario extendido.' },
  { name: 'Trimestral Premium', price: 239_000, durationDays: 90, level: MembershipLevel.PREMIUM, includes: true, description: 'Acceso completo más clases grupales ilimitadas.' },
  { name: 'Anual Atleta', price: 890_000, durationDays: 365, level: MembershipLevel.ATHLETE, includes: true, description: 'Acceso 24/7, clases, valoraciones y zona de recuperación.' },
];

async function seed(dataSource: DataSource): Promise<void> {
  await dataSource.synchronize();
  const users = dataSource.getRepository(User);
  if ((await users.count()) > 0) {
    console.log('La base de datos ya contiene información: no se sembró.');
    return;
  }

  const password = async (value: string) => bcrypt.hash(value, 12);
  const admin = await users.save(
    users.create({
      firstName: 'Administrador',
      lastName: 'GymSoftware',
      email: 'admin@gymsoftware.test',
      role: Role.ADMIN,
      passwordHash: await password('Admin1234'),
    }),
  );
  const trainer = await users.save(
    users.create({
      firstName: 'Entrenador',
      lastName: 'Staff',
      email: 'staff@gymsoftware.test',
      role: Role.STAFF,
      passwordHash: await password('Staff1234'),
    }),
  );
  await users.save(
    users.create({
      firstName: 'Cliente',
      lastName: 'Demo',
      email: 'cliente@gymsoftware.test',
      role: Role.CLIENT,
      passwordHash: await password('Cliente1234'),
    }),
  );

  const categories = dataSource.getRepository(Category);
  const bySlug = new Map<string, Category>();
  for (const item of CATEGORIES) {
    const saved = await categories.save(categories.create(item));
    bySlug.set(saved.slug, saved);
  }

  const products = dataSource.getRepository(Product);
  const serviceBySku = new Map<string, Product>();
  for (const item of PRODUCTS) {
    const category = bySlug.get(item.category);
    if (!category) throw new Error(`Categoría no encontrada: ${item.category}`);
    const saved = await products.save(
      products.create({
        name: item.name,
        sku: item.sku,
        description: item.description,
        price: item.price.toFixed(2),
        currency: 'COP',
        imageUrl: item.imageUrl ?? null,
        kind: item.kind ?? ProductKind.PRODUCT,
        stock: item.stock ?? null,
        durationMinutes: item.durationMinutes ?? null,
        categoryId: category.id,
      }),
    );
    serviceBySku.set(saved.sku, saved);
  }

  const plans = dataSource.getRepository(MembershipPlan);
  for (const plan of PLANS) {
    await plans.save(
      plans.create({
        name: plan.name,
        description: plan.description,
        price: plan.price.toFixed(2),
        currency: 'COP',
        durationDays: plan.durationDays,
        accessLevel: plan.level,
        includesClasses: plan.includes,
      }),
    );
  }

  const schedules = dataSource.getRepository(ClassSchedule);
  const base = new Date();
  const templates = [
    { title: 'Fuerza circular', offsetDays: 1, hour: 7, capacity: 12, room: 'Dojo', service: null },
    { title: 'Movilidad y estiramiento', offsetDays: 1, hour: 18, capacity: 15, room: 'Sala 2', service: 'SRV-ASSESS' },
    { title: 'Entrenamiento funcional', offsetDays: 2, hour: 6, capacity: 10, room: 'Box', service: null },
    { title: 'Spinning', offsetDays: 2, hour: 19, capacity: 16, room: 'Sala 1', service: null },
    { title: 'Entrenador personal', offsetDays: 3, hour: 10, capacity: 1, room: 'Piso', service: 'SRV-PT-4' },
  ];

  for (const template of templates) {
    const startsAt = new Date(base.getTime() + template.offsetDays * day);
    startsAt.setHours(template.hour, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    await schedules.save(
      schedules.create({
        title: template.title,
        startsAt,
        endsAt,
        capacity: template.capacity,
        room: template.room,
        trainerId: trainer.id,
        productId: template.service ? serviceBySku.get(template.service)?.id ?? null : null,
      }),
    );
  }

  console.log('Datos de demostración creados.');
  console.log(`  admin: ${admin.email} / Admin1234`);
  console.log(`  staff: ${trainer.email} / Staff1234`);
  console.log('  cliente: cliente@gymsoftware.test / Cliente1234');
}

void appDataSource
  .initialize()
  .then(seed)
  .then(async () => appDataSource.destroy())
  .catch(async (error: Error) => {
    console.error('Error sembrando la base de datos:', error.message);
    await appDataSource.destroy().catch(() => undefined);
    process.exit(1);
  });
