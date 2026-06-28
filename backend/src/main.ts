import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './logger/winston.config';

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

  const missing = requiredEnvVars.filter(
    (key) => !configService.get<string>(key),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`,
    );
  }

  if (configService.get<string>('STORAGE_TYPE') !== 'supabase') {
    throw new Error('STORAGE_TYPE must be "supabase" in production');
  }
}

function parseCorsOrigins(configService: ConfigService): string[] {
  return (
    configService.get<string>('CORS_ORIGIN') ??
    configService.get<string>('CORS_ORIGINS') ??
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const configService = app.get(ConfigService);
  requireProductionEnv(configService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = parseCorsOrigins(configService);

  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: isProduction ? 'same-origin' : 'cross-origin',
      },
    }),
  );

  const logger = new Logger('RequestTiming');
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 300) {
        logger.log(
          `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode} ${durationMs}ms`,
        );
      }
    });
    next();
  });

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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Fentri MVP API')
      .setDescription(
        'API central del sistema Fentri. La ruta oficial para owners es /owners.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);

  const startupLogger = new Logger('Bootstrap');
  const env = configService.get<string>('NODE_ENV') ?? 'development';
  const storageType = configService.get<string>('STORAGE_TYPE') ?? 'local';
  const cfStreamEnabled = configService.get<string>('CLOUDFLARE_STREAM_ENABLED') === 'true';
  const cfSignedUrls = configService.get<string>('CLOUDFLARE_STREAM_SIGNED_URLS') === 'true';

  startupLogger.log(`Fentri API listening on port ${port} [${env}]`);
  startupLogger.log(`storage=${storageType} cf_stream=${cfStreamEnabled} signed_urls=${cfSignedUrls}`);
}
bootstrap();
