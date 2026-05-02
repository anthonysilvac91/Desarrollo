import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function requireProductionEnv(configService: ConfigService) {
  if (configService.get<string>('NODE_ENV') !== 'production') {
    return;
  }

  const requiredEnvVars = [
    'DATABASE_URL',
    'DIRECT_URL',
    'JWT_SECRET',
    'STORAGE_TYPE',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PUBLIC_BUCKET',
    'SUPABASE_PRIVATE_BUCKET',
    'SIGNED_URL_TTL_SECONDS',
    'CORS_ORIGIN',
  ];

  const missing = requiredEnvVars.filter((key) => !configService.get<string>(key));
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  if (configService.get<string>('STORAGE_TYPE') !== 'supabase') {
    throw new Error('STORAGE_TYPE must be "supabase" in production');
  }
}

function parseCorsOrigins(configService: ConfigService): string[] {
  return (configService.get<string>('CORS_ORIGIN') ?? configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  requireProductionEnv(configService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = parseCorsOrigins(configService);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!isProduction && allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Recall MVP API')
    .setDescription('API central del sistema Recall. Gestion multitenant de activos y servicios.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
bootstrap();
