import { Module } from '@nestjs/common';
import { OwnersService } from './companies.service';
import { OwnersController } from './owners.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [OwnersController],
  providers: [OwnersService, PrismaService],
  exports: [OwnersService],
})
export class CompaniesModule {}
