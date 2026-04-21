import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  console.log('--- DIAGNÓSTICO DE ARRANQUE ---');
  console.log('NODE_ENV:', configService.get('NODE_ENV'));
  console.log('DATABASE_URL detectado:', !!configService.get('DATABASE_URL'));
  console.log('JWT_SECRET detectado:', !!configService.get('JWT_SECRET'));
  console.log('-------------------------------');

  app.enableCors({
    origin: true, // Permite cualquier origin (ideal para local: 3001, 3000, etc)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true
    }
  }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Recall MVP API')
    .setDescription('API central del sistema Recall. Gestión multitenant de activos y servicios.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
bootstrap();
