import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './logger/winston.config';
import type { NextFunction, Request, Response } from 'express';

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
  ];
  if (configService.get<string>('CLOUDFLARE_STREAM_ENABLED') === 'true') {
    requiredEnvVars.push(
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN',
      'CLOUDFLARE_STREAM_WEBHOOK_SECRET',
      'CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS',
    );
  }

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  if (!corsOrigin && !frontendUrl) {
    requiredEnvVars.push('CORS_ORIGIN or FRONTEND_URL');
  }

  const missing = requiredEnvVars.filter((key) => {
    if (key === 'CORS_ORIGIN or FRONTEND_URL') {
      return !corsOrigin && !frontendUrl;
    }
    return !configService.get<string>(key);
  });
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
  const rawOrigins = [
    configService.get<string>('FRONTEND_URL'),
    configService.get<string>('CORS_ORIGIN'),
    configService.get<string>('CORS_ORIGINS'),
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','));

  return rawOrigins
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return origin;
      }
    });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
    rawBody: true,
  });
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  expressApp.set('trust proxy', 1);

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
  app.use((req: Request, res: Response, next: NextFunction) => {
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
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
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
  const cfStreamEnabled =
    configService.get<string>('CLOUDFLARE_STREAM_ENABLED') === 'true';
  const cfSignedUrls =
    configService.get<string>('CLOUDFLARE_STREAM_SIGNED_URLS') === 'true';

  startupLogger.log(`Fentri API listening on port ${port} [${env}]`);
  startupLogger.log(
    `storage=${storageType} cf_stream=${cfStreamEnabled} signed_urls=${cfSignedUrls}`,
  );
}
void bootstrap();
