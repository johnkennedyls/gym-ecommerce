# GymSoftware — e-commerce para gimnasios

Plataforma web para vender productos y servicios de gimnasio, administrar membresías, tomar
reservas de clases y procesar pagos. El proyecto se entrega con la API REST y el frontend
consumidos entre sí, pruebas automatizadas y el informe de calidad de software.

| Carpeta | Contenido | Tecnología |
| --- | --- | --- |
| `backend/` | API REST, reglas de negocio, acceso a datos, seed y pruebas | Node.js 20+, NestJS 11, TypeORM, PostgreSQL |
| `frontend/` | Tienda y panel administrativo | React 19, TypeScript, Vite, react-router 7 |
| `Informe_Calidad_Software_Ecommerce_Gimnasios.docx` | Entrega académica (requerimientos, calidad, pruebas, métricas) | Word |
| `informe.txt` | La misma entrega en texto plano | Texto |

## Requisitos

- Node.js 20 o superior (`node -v`).
- PostgreSQL 18 en ejecución, con un usuario que pueda crear bases de datos.
- Git.

Los comandos están escritos para **PowerShell** de Windows.

## 1. Base de datos

Abre PowerShell y crea la base de desarrollo y la de pruebas:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE gymsoftware;"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE gymsoftware_test;"
```

La base de pruebas se llama `gymsoftware_test` porque la configuración añade el sufijo `_test`
cuando `NODE_ENV=test`.

## 2. Backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Edita `.env` y ajusta estos valores (son los únicos que suelen cambiar en una máquina nueva):

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_USER` / `DATABASE_PASSWORD` | Usuario y clave de tu PostgreSQL local. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Firma de los tokens. Deben tener 16 caracteres o más o la API no arranca. |
| `APP_CORS_ORIGIN` | Origen permitido; por defecto `http://localhost:5173` (la URL de Vite). |

Siembra los datos de demostración (crea las tablas y carga catálogo, planes y horarios):

```powershell
npm run seed
```

Levanta la API:

```powershell
npm run start:dev
```

- API: `http://localhost:3000/api`
- Documentación OpenAPI (Swagger): `http://localhost:3000/api/docs`
- Estado del servicio: `http://localhost:3000/api/health`

## 3. Frontend

Desde otra ventana de PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Vite redirige las llamadas `/api` al backend en el puerto 3000,
así que no necesitas configurar CORS en desarrollo.

## 4. Pruebas automatizadas

```powershell
cd backend
npm test              # 31 pruebas unitarias de reglas de negocio
npm run test:e2e      # 41 pruebas de integración sobre la API real (requiere gymsoftware_test)
npm run test:cov      # unitarias + informe de cobertura en coverage/
```

```powershell
cd frontend
npm run build         # compilación con chequeo estricto de tipos
```

## 5. Cuentas y tarjetas de prueba

Cuentas creadas por `npm run seed`:

| Rol | Correo | Contraseña | Qué habilita |
| --- | --- | --- | --- |
| Administrador | `admin@gymsoftware.test` | `Admin1234` | Todo el panel `/admin`. |
| Personal | `staff@gymsoftware.test` | `Staff1234` | Horarios y asistencia de clases. |
| Cliente | `cliente@gymsoftware.test` | `Cliente1234` | Compras, membresías y reservas. |

Tarjetas de la pasarela sandbox (`PAYMENT_GATEWAY=sandbox`):

| Tarjeta | Resultado |
| --- | --- |
| `4242 4242 4242 4242` | Aprobada |
| Terminada en `0002` (p. ej. `4000 0000 0000 0002`) | Rechazada |
| Fecha de vencimiento en el pasado | Rechazada |
| Que no pasa el algoritmo de Luhn con `SANDBOX_STRICT_MODE=true` | Error de validación |

## 6. Funcionalidad cubierta

Autenticación con JWT de acceso y refresco, registro y recuperación de contraseña, catálogo con
búsqueda, filtros y ordenamiento, carrito persistente, checkout con pago aprobado o rechazado,
historial de pedidos, compra y cancelación de membresías, reserva y cancelación de clases con
regla de 2 horas, notificaciones internas, panel administrativo (producto, inventario, pedidos,
usuarios y roles, planes, horarios, reservas y bitácora de auditoría) y reportes de ventas.

El detalle de requerimientos, calidad, riesgos y métricas está en el informe.

## 7. Problemas frecuentes

- **`El proyecto no arranca y habla de secretos`** — `JWT_ACCESS_SECRET` o `JWT_REFRESH_SECRET`
  están vacíos o miden menos de 16 caracteres, falta `DATABASE_PASSWORD`, o `DATABASE_USER` no
  coincide con tu PostgreSQL.
- **`ECONNREFUSED 5432`** — el servicio `postgresql-x64-18` está detenido:
  `Start-Service postgresql-x64-18`.
- **`429 Too Many Requests` al iniciar sesión** — el límite de intentos por autenticación está
  activo por OWASP. Espera un minuto o sube `THROTTLE_LOGIN_LIMIT` en `.env`.
- **`no se pudo conectar a /api`** — el backend no está corriendo o cambió de puerto; ajusta la
  constante `API_TARGET` en `frontend/vite.config.ts`.
- **Las contraseñas del seed no sirven** — vuelve a ejecutar `npm run seed`; el script se detiene
  si ya existen usuarios, así que no sobreescribe una base modificada.
