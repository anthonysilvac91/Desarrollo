import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

export interface AcquiredMaintenanceLock {
  name: string;
  ownerId: string;
}

@Injectable()
export class MaintenanceLockService {
  private readonly logger = new Logger(MaintenanceLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async acquire(
    name: string,
    ttlSeconds: number,
  ): Promise<AcquiredMaintenanceLock | null> {
    const ownerId = `${process.env.RAILWAY_REPLICA_ID ?? process.env.HOSTNAME ?? 'local'}:${randomUUID()}`;
    const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
      INSERT INTO "MaintenanceJobLock" ("name", "locked_until", "locked_by", "updated_at")
      VALUES (${name}, NOW() + (${ttlSeconds} || ' seconds')::interval, ${ownerId}, NOW())
      ON CONFLICT ("name") DO UPDATE
        SET "locked_until" = NOW() + (${ttlSeconds} || ' seconds')::interval,
            "locked_by" = ${ownerId},
            "updated_at" = NOW()
      WHERE "MaintenanceJobLock"."locked_until" < NOW()
      RETURNING "name"
    `;

    if (rows.length === 0) {
      this.logger.log(
        JSON.stringify({ event: 'maintenance_lock_skipped', name }),
      );
      return null;
    }

    this.logger.log(
      JSON.stringify({ event: 'maintenance_lock_acquired', name, ownerId }),
    );
    return { name, ownerId };
  }

  async release(lock: AcquiredMaintenanceLock): Promise<void> {
    await this.prisma.maintenanceJobLock.updateMany({
      where: { name: lock.name, locked_by: lock.ownerId },
      data: { locked_until: new Date(0) },
    });
    this.logger.log(
      JSON.stringify({
        event: 'maintenance_lock_released',
        name: lock.name,
        ownerId: lock.ownerId,
      }),
    );
  }
}
