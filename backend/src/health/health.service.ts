import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<void> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    } catch (err) {
      this.logger.error(
        'Database health check failed',
        err instanceof Error ? err.message : 'unknown error',
      );
      throw err;
    }
  }
}
