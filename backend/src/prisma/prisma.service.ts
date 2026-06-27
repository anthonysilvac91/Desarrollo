import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const SLOW_QUERY_MS = 500;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });
  }

  async onModuleInit() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.$on as any)('query', (e: { duration: number; query: string }) => {
      if (e.duration >= SLOW_QUERY_MS) {
        const snippet = e.query.replace(/\s+/g, ' ').trim().slice(0, 200);
        this.logger.warn(`slow_query ${e.duration}ms — ${snippet}`);
      }
    });
    await this.$connect();
  }
}
