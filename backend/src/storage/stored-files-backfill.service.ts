import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface StoredFilesBackfillOptions {
  dryRun?: boolean;
}

export interface StoredFilesBackfillSummary {
  scanned: number;
  linked: number;
  created: number;
  reused: number;
  skipped: number;
  warnings: number;
  sections: Record<string, StoredFilesBackfillSectionSummary>;
}

interface StoredFilesBackfillSectionSummary {
  scanned: number;
  linked: number;
  created: number;
  reused: number;
  skipped: number;
  warnings: number;
}

export interface EntityTypeIntegrityResult {
  missing: number;
  invalidValues: Array<{ entity_type: string; count: number }>;
}

@Injectable()
export class StoredFilesBackfillService {
  private readonly logger = new Logger(StoredFilesBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async backfill(_options: StoredFilesBackfillOptions = {}): Promise<StoredFilesBackfillSummary> {
    this.logger.warn('Legacy URL backfill is disabled because legacy URL columns were removed in Phase 7.4.');

    return {
      scanned: 0,
      linked: 0,
      created: 0,
      reused: 0,
      skipped: 0,
      warnings: 1,
      sections: {},
    };
  }

  async validateEntityTypeIntegrity(): Promise<EntityTypeIntegrityResult> {
    const [{ count: missingCount }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "StoredFile"
      WHERE entity_type IS NULL OR entity_id IS NULL
    `;
    const missing = Number(missingCount);

    const invalid = await this.prisma.$queryRaw<Array<{ entity_type: string; count: bigint }>>`
      SELECT entity_type, COUNT(*) as count
      FROM "StoredFile"
      WHERE entity_type IS NOT NULL
        AND entity_type NOT IN ('ORGANIZATION', 'OWNER', 'USER', 'ASSET', 'SERVICE')
      GROUP BY entity_type
      ORDER BY entity_type
    `;

    return {
      missing,
      invalidValues: invalid.map((row) => ({ entity_type: row.entity_type, count: Number(row.count) })),
    };
  }
}
