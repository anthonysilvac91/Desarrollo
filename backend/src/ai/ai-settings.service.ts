import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOpenAiSettingsDto } from './ai-settings.dto';
import { aesGcmDecrypt, aesGcmEncrypt } from '../common/crypto.util';

const OPENAI_PROVIDER = 'openai';
const DEFAULT_MODEL = 'gpt-5.4-nano';

@Injectable()
export class AiSettingsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getOpenAiSettings() {
    const settings = await this.getOrCreateOpenAiSettings();
    return this.toPublicSettings(settings);
  }

  async updateOpenAiSettings(
    dto: UpdateOpenAiSettingsDto,
    configuredByUserId: string,
  ) {
    const data: any = {
      model: dto.model?.trim() || DEFAULT_MODEL,
      configured_by_user_id: configuredByUserId,
    };

    if (dto.translations_enabled !== undefined) {
      data.translations_enabled = dto.translations_enabled;
    }

    if (dto.translate_services_created_after !== undefined) {
      data.translate_services_created_after =
        dto.translate_services_created_after
          ? new Date(dto.translate_services_created_after)
          : null;
    }

    if (dto.api_key !== undefined && dto.api_key.trim()) {
      const apiKey = dto.api_key.trim();
      data.encrypted_api_key = this.encrypt(apiKey);
      data.api_key_hint = this.buildApiKeyHint(apiKey);
    }

    const settings = await this.prisma.aiProviderSetting.upsert({
      where: { provider: OPENAI_PROVIDER },
      create: {
        provider: OPENAI_PROVIDER,
        ...data,
      },
      update: data,
    });

    return this.toPublicSettings(settings);
  }

  async getOpenAiRuntimeConfig() {
    const settings = await this.prisma.aiProviderSetting.findUnique({
      where: { provider: OPENAI_PROVIDER },
    });

    if (!settings?.translations_enabled) {
      return null;
    }

    const encryptedApiKey = settings.encrypted_api_key;
    const envApiKey = this.configService.get<string>('OPENAI_API_KEY');
    const apiKey = encryptedApiKey ? this.decrypt(encryptedApiKey) : envApiKey;

    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      model: settings.model || DEFAULT_MODEL,
      translateServicesCreatedAfter: settings.translate_services_created_after,
    };
  }

  async testOpenAiConnection() {
    const runtime = await this.getOpenAiRuntimeConfig();
    if (!runtime) {
      throw new BadRequestException(
        'OpenAI no esta configurado o la traduccion esta desactivada',
      );
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtime.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: runtime.model,
        input: 'Return only the word ok.',
        max_output_tokens: 16,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new BadRequestException(
        `OpenAI respondio con error ${response.status}: ${details.slice(0, 200)}`,
      );
    }

    return { ok: true };
  }

  private async getOrCreateOpenAiSettings() {
    return this.prisma.aiProviderSetting.upsert({
      where: { provider: OPENAI_PROVIDER },
      create: {
        provider: OPENAI_PROVIDER,
        model:
          this.configService.get<string>('OPENAI_TRANSLATION_MODEL') ||
          DEFAULT_MODEL,
        translations_enabled: false,
      },
      update: {},
    });
  }

  private toPublicSettings(settings: any) {
    return {
      provider: settings.provider,
      model: settings.model,
      translations_enabled: settings.translations_enabled,
      translate_services_created_after:
        settings.translate_services_created_after,
      api_key_configured: Boolean(
        settings.encrypted_api_key ||
        this.configService.get<string>('OPENAI_API_KEY'),
      ),
      api_key_hint:
        settings.api_key_hint ??
        (this.configService.get<string>('OPENAI_API_KEY')
          ? 'env configured'
          : null),
      updated_at: settings.updated_at,
    };
  }

  private encrypt(value: string) {
    const secret =
      this.configService.get<string>('INTEGRATION_SECRET_KEY') ||
      this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new BadRequestException(
        'INTEGRATION_SECRET_KEY o JWT_SECRET es requerido para cifrar integraciones',
      );
    }
    return aesGcmEncrypt(value, secret);
  }

  private decrypt(value: string) {
    const secret =
      this.configService.get<string>('INTEGRATION_SECRET_KEY') ||
      this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new BadRequestException(
        'INTEGRATION_SECRET_KEY o JWT_SECRET es requerido para cifrar integraciones',
      );
    }
    try {
      return aesGcmDecrypt(value, secret);
    } catch {
      throw new BadRequestException(
        'La API key cifrada no tiene un formato valido',
      );
    }
  }

  private buildApiKeyHint(apiKey: string) {
    if (apiKey.length <= 10) {
      return 'configured';
    }

    return `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`;
  }
}
