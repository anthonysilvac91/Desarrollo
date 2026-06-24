import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UploadMaintenanceService } from '../src/uploads/upload-maintenance.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const maintenance = app.get(UploadMaintenanceService);
    const result = await maintenance.runHourlyMaintenance();
    console.log(
      JSON.stringify({ event: 'upload_maintenance_cli_completed', ...result }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: 'upload_maintenance_cli_failed',
      error: error instanceof Error ? error.message : 'unknown_error',
    }),
  );
  process.exit(1);
});
