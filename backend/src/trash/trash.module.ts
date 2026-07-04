import { Module } from '@nestjs/common';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageModule } from '../storage/storage.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import { AssetsService } from '../assets/assets.service';
import { ServicesService } from '../services/services.service';

@Module({
  imports: [StorageModule, UploadsModule, CompaniesModule, UsersModule],
  controllers: [TrashController],
  providers: [TrashService, PrismaService, AssetsService, ServicesService],
})
export class TrashModule {}
