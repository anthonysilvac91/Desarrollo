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
class StoredFilesBackfillCliModule {}

async function bootstrap() {
  const logger = new Logger('StoredFilesBackfillCli');
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(StoredFilesBackfillCliModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    logger.log(`Iniciando backfill legacy -> StoredFile${dryRun ? ' (dry-run)' : ''}`);
    const backfillService = app.get(StoredFilesBackfillService);
    const summary = await backfillService.backfill({ dryRun });
    logger.log(`Backfill completado${dryRun ? ' (dry-run)' : ''}`);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
