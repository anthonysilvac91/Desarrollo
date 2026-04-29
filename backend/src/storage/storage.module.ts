import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { StorageGovernanceService } from './storage-governance.service';
import { StoredFilesService } from './stored-files.service';
import { StoredFilesBackfillService } from './stored-files-backfill.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: StorageService,
      useFactory: (configService: ConfigService) => {
        const type = configService.get<string>('STORAGE_TYPE', 'local');
        return type === 'supabase' 
          ? new SupabaseStorageService(configService)
          : new LocalStorageService(configService);
      },
      inject: [ConfigService],
    },
    StorageGovernanceService,
    StoredFilesService,
    StoredFilesBackfillService,
  ],
  exports: [StorageService, StorageGovernanceService, StoredFilesService, StoredFilesBackfillService],
})
export class StorageModule {}
