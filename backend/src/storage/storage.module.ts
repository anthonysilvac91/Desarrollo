import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Global()
@Module({
  providers: [
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
  ],
  exports: [StorageService],
})
export class StorageModule {}
