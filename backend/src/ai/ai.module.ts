import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { TranslationService } from './translation.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [AiSettingsController],
  providers: [AiSettingsService, TranslationService, PrismaService],
  exports: [AiSettingsService, TranslationService],
})
export class AiModule {}
