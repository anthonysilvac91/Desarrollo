import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { StorageGovernanceService } from './storage-governance.service';

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
  ],
  exports: [StorageService, StorageGovernanceService],
})
export class StorageModule {}
