// Carga .env antes de importar la aplicación: los límites de tasa se resuelven al definir los controladores.
import 'dotenv/config';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppEnvironment } from './config/environment';
import { APP_ENV } from './config/tokens';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const environment = app.get<AppEnvironment>(APP_ENV);
  const logger = new Logger('GymSoftware');

  // RNF-01 / OWASP: cabeceras de seguridad y CORS restringido al frontend.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: environment.corsOrigin.split(',').map((value) => value.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle(`${environment.appName} API`)
    .setDescription('API REST del e-commerce para gimnasios (RF-01 a RF-15)')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(environment.port, '0.0.0.0');
  logger.log(`${environment.appName} escuchando en http://localhost:${environment.port}/api`);
  logger.log(`Documentación OpenAPI en http://localhost:${environment.port}/api/docs`);
}

void bootstrap();
