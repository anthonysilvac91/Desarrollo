import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HealthService } from './health.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    const timestamp = new Date().toISOString();
    try {
      await this.healthService.checkDatabase();
      res.status(200).json({ status: 'ok', database: 'ok', timestamp });
    } catch {
      res.status(503).json({ status: 'error', database: 'error', timestamp });
    }
  }
}
