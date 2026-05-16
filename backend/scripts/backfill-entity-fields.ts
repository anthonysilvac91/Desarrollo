import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { StorageModule } from '../src/storage/storage.module';
import { StoredFilesBackfillService } from '../src/storage/stored-files-backfill.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    StorageModule,
  ],
})
class EntityFieldsBackfillCliModule {}

async function bootstrap() {
  const logger = new Logger('EntityFieldsBackfillCli');

  const app = await NestFactory.createApplicationContext(EntityFieldsBackfillCliModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const backfillService = app.get(StoredFilesBackfillService);

    logger.log('Ejecutando validacion de integridad...');
    const integrity = await backfillService.validateEntityTypeIntegrity();
    process.stdout.write(`\nIntegrity check:\n${JSON.stringify(integrity, null, 2)}\n`);

    const isValid = integrity.missing === 0 && integrity.invalidValues.length === 0;

    if (isValid) {
      logger.log('Validacion OK: entity_type y entity_id presentes y con valores validos en todos los registros.');
    } else {
      if (integrity.missing > 0) {
        logger.warn(`${integrity.missing} registros sin entity_type o entity_id.`);
      }
      if (integrity.invalidValues.length > 0) {
        logger.error(`Valores invalidos en entity_type: ${JSON.stringify(integrity.invalidValues)}`);
      }
      process.exit(1);
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
