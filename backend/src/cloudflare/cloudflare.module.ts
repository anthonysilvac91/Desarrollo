import { Module } from '@nestjs/common';
import { CloudflareService } from './cloudflare.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [CloudflareService, PrismaService],
  exports: [CloudflareService],
})
export class CloudflareModule {}
