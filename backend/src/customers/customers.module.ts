import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CompaniesController } from './companies.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CustomersController, CompaniesController],
  providers: [CustomersService, PrismaService],
  exports: [CustomersService],
})
export class CustomersModule {}
