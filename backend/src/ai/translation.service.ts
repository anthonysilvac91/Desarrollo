import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';

const SUPPORTED_LANGUAGES = new Set(['es', 'en']);
const SKIP_TERMS = [
  'test',
  'prueba',
  'demo',
  'lorem',
  'asdf',
  'xxx',
  'qwerty',
  'basura',
];

type TranslationStatus =
  | 'original'
  | 'translated'
  | 'skipped_disabled'
  | 'skipped_same_language'
  | 'skipped_low_quality'
  | 'skipped_date'
  | 'skipped_unsupported_language'
  | 'failed';

type TranslatableField = 'title' | 'description';

interface TranslatedField {
  text: string | null;
  original_text: string | null;
  original_language: string | null;
  translated_language: string | null;
  is_translated: boolean;
  translation_status: TranslationStatus;
}

export interface TranslatedDescription {
  description: string | null;
  original_description: string | null;
  original_language: string | null;
  translated_language: string | null;
  is_translated: boolean;
  translation_status: TranslationStatus;
}

export interface TranslatedTitle {
  title: string;
  original_title: string | null;
  is_title_translated: boolean;
  title_translation_status: TranslationStatus;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettingsService: AiSettingsService,
  ) {}

  async translateServiceDescription(
    service: any,
    targetLanguage?: string | null,
  ): Promise<TranslatedDescription> {
    const result = await this.translateField({
      service,
      field: 'description',
      sourceText: service.description,
      cachedLanguage: service.description_language ?? null,
      targetLanguage,
    });

    return {
      description: result.text,
      original_description: result.original_text,
      original_language: result.original_language,
      translated_language: result.translated_language,
      is_translated: result.is_translated,
      translation_status: result.translation_status,
    };
  }

  async translateServiceTitle(
    service: any,
    targetLanguage?: string | null,
  ): Promise<TranslatedTitle> {
    const result = await this.translateField({
      service,
      field: 'title',
      sourceText: service.title,
      cachedLanguage: service.description_language ?? null,
      targetLanguage,
    });

    return {
      title: result.text ?? service.title,
      original_title: result.original_text,
      is_title_translated: result.is_translated,
      title_translation_status: result.translation_status,
    };
  }

  private async translateField(params: {
    service: any;
    field: TranslatableField;
    sourceText: string | null | undefined;
    cachedLanguage: string | null;
    targetLanguage?: string | null;
  }): Promise<TranslatedField> {
    const { service, field, cachedLanguage } = params;
    const original = params.sourceText?.trim() || null;
    const normalizedTarget = this.normalizeLanguage(params.targetLanguage);

    if (!original) {
      return this.fieldPayload(original, cachedLanguage, normalizedTarget, 'original');
    }

    if (!normalizedTarget) {
      return this.fieldPayload(
        original,
        cachedLanguage,
        null,
        'skipped_unsupported_language',
      );
    }

    if (!this.isTextEligible(original, field)) {
      return this.fieldPayload(
        original,
        cachedLanguage,
        normalizedTarget,
        'skipped_low_quality',
      );
    }

    const detectedLanguage =
      cachedLanguage || this.detectLanguageHeuristic(original);
    if (detectedLanguage && detectedLanguage === normalizedTarget) {
      if (field === 'description') {
        await this.persistDetectedLanguage(service.id, detectedLanguage, cachedLanguage);
      }
      return this.fieldPayload(
        original,
        detectedLanguage,
        normalizedTarget,
        'skipped_same_language',
      );
    }

    const runtime = await this.aiSettingsService.getOpenAiRuntimeConfig();
    if (!runtime) {
      return this.fieldPayload(
        original,
        detectedLanguage,
        normalizedTarget,
        'skipped_disabled',
      );
    }

    if (
      runtime.translateServicesCreatedAfter &&
      service.created_at < runtime.translateServicesCreatedAfter
    ) {
      return this.fieldPayload(
        original,
        detectedLanguage,
        normalizedTarget,
        'skipped_date',
      );
    }

    const sourceHash = this.hashText(original);
    const cached = await this.prisma.serviceTranslation.findUnique({
      where: {
        service_id_field_language: {
          service_id: service.id,
          field,
          language: normalizedTarget,
        },
      },
    });

    if (cached?.source_hash === sourceHash) {
      return {
        text: cached.translated_text,
        original_text: original,
        original_language: cached.source_language ?? detectedLanguage,
        translated_language: normalizedTarget,
        is_translated: true,
        translation_status: 'translated',
      };
    }

    try {
      const generated = await this.requestOpenAiTranslation({
        apiKey: runtime.apiKey,
        model: runtime.model,
        text: original,
        targetLanguage: normalizedTarget,
      });

      const sourceLanguage =
        this.normalizeLanguage(generated.source_language) ??
        detectedLanguage ??
        null;
      if (sourceLanguage && sourceLanguage === normalizedTarget) {
        if (field === 'description') {
          await this.persistDetectedLanguage(service.id, sourceLanguage, cachedLanguage);
        }
        return this.fieldPayload(
          original,
          sourceLanguage,
          normalizedTarget,
          'skipped_same_language',
        );
      }

      if (!generated.translated_text?.trim()) {
        return this.fieldPayload(
          original,
          sourceLanguage,
          normalizedTarget,
          'failed',
        );
      }

      const translation = await this.prisma.serviceTranslation.upsert({
        where: {
          service_id_field_language: {
            service_id: service.id,
            field,
            language: normalizedTarget,
          },
        },
        create: {
          service_id: service.id,
          field,
          language: normalizedTarget,
          source_hash: sourceHash,
          source_language: sourceLanguage,
          translated_text: generated.translated_text.trim(),
        },
        update: {
          source_hash: sourceHash,
          source_language: sourceLanguage,
          translated_text: generated.translated_text.trim(),
          status: 'ready',
        },
      });

      if (field === 'description') {
        await this.persistDetectedLanguage(service.id, sourceLanguage, cachedLanguage);
      }

      return {
        text: translation.translated_text,
        original_text: original,
        original_language: sourceLanguage,
        translated_language: normalizedTarget,
        is_translated: true,
        translation_status: 'translated',
      };
    } catch (error) {
      this.logger.warn(
        `OpenAI translation failed for service ${service.id} (${field}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.fieldPayload(
        original,
        detectedLanguage,
        normalizedTarget,
        'failed',
      );
    }
  }

  detectLanguageHeuristic(text?: string | null): string | null {
    if (!text) return null;
    const normalized = this.normalizeText(text);
    const spanishSignals = [
      ' el ',
      ' la ',
      ' los ',
      ' las ',
      ' de ',
      ' del ',
      ' se ',
      ' con ',
      ' para ',
      ' revision ',
      ' cambio ',
      ' lavado ',
      ' motor ',
      ' aceite ',
      ' filtro ',
      ' servicio ',
      ' realizado ',
    ];
    const englishSignals = [
      ' the ',
      ' and ',
      ' with ',
      ' for ',
      ' service ',
      ' engine ',
      ' oil ',
      ' filter ',
      ' replaced ',
      ' checked ',
      ' completed ',
    ];
    const padded = ` ${normalized} `;
    const spanishScore = spanishSignals.filter((signal) =>
      padded.includes(signal),
    ).length;
    const englishScore = englishSignals.filter((signal) =>
      padded.includes(signal),
    ).length;

    if (/[ñáéíóúü¿¡]/i.test(text) || spanishScore > englishScore) return 'es';
    if (englishScore > spanishScore) return 'en';
    return null;
  }

  private async requestOpenAiTranslation(params: {
    apiKey: string;
    model: string;
    text: string;
    targetLanguage: string;
  }): Promise<{ source_language?: string; translated_text?: string }> {
    const targetLabel = params.targetLanguage === 'es' ? 'Spanish' : 'English';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        input: [
          {
            role: 'system',
            content:
              'You translate short technical service titles and descriptions. Preserve brands, names, serial numbers, codes, dates, quantities and units. Do not add information. Return only compact JSON.',
          },
          {
            role: 'user',
            content: `Target language: ${targetLabel}\nReturn JSON with keys source_language and translated_text.\nText:\n${params.text}`,
          },
        ],
        max_output_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI error ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    }

    const payload: any = await response.json();
    const outputText = this.extractOutputText(payload);
    const jsonMatch = outputText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('OpenAI response did not include JSON');
    }

    return JSON.parse(jsonMatch[0]);
  }

  private extractOutputText(payload: any): string {
    if (typeof payload.output_text === 'string') {
      return payload.output_text;
    }

    const parts =
      payload.output?.flatMap((item: any) => item.content ?? []) ?? [];
    return parts
      .map((part: any) => part.text ?? '')
      .filter(Boolean)
      .join('\n');
  }

  private fieldPayload(
    text: string | null,
    originalLanguage: string | null,
    targetLanguage: string | null,
    status: TranslationStatus,
  ): TranslatedField {
    return {
      text,
      original_text: text,
      original_language: originalLanguage,
      translated_language: targetLanguage,
      is_translated: false,
      translation_status: status,
    };
  }

  private normalizeLanguage(language?: string | null): string | null {
    if (!language) return null;
    const normalized = language.toLowerCase().split('-')[0];
    return SUPPORTED_LANGUAGES.has(normalized) ? normalized : null;
  }

  private isTextEligible(text: string, field: TranslatableField): boolean {
    const normalized = this.normalizeText(text);
    const words = normalized.split(/\s+/).filter(Boolean);
    const hasRepeatedCharacters = /(.)\1{4,}/.test(normalized);
    const hasSkipTerm = SKIP_TERMS.some(
      (term) => normalized === term || normalized.includes(term),
    );
    // Titles are legitimately short (unlike descriptions), so they get a much
    // lighter length/word-count bar - we still filter out junk/placeholder text.
    const minLength = field === 'title' ? 3 : 20;
    const minWords = field === 'title' ? 1 : 3;
    return (
      normalized.length >= minLength &&
      words.length >= minWords &&
      !hasRepeatedCharacters &&
      !hasSkipTerm
    );
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  private async persistDetectedLanguage(
    serviceId: string,
    language?: string | null,
    currentLanguage?: string | null,
  ) {
    if (!language || currentLanguage) {
      return;
    }

    await this.prisma.service.update({
      where: { id: serviceId },
      data: { description_language: language },
    });
  }
}
