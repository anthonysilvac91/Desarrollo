import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CustomersLegacyController } from './customers-legacy.controller';
import { CompaniesController } from './companies.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CustomersLegacyController, CompaniesController],
  providers: [CompaniesService, PrismaService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
