import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import maxmind, { CityResponse, Reader } from 'maxmind';

export type GeoSource = 'maxmind_geolite2' | 'unknown';

export interface GeoIpResult {
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  accuracyRadius: number | null;
  source: GeoSource;
}

const UNKNOWN_RESULT: GeoIpResult = {
  country: null,
  countryCode: null,
  region: null,
  city: null,
  accuracyRadius: null,
  source: 'unknown',
};

const CACHE_MAX_ENTRIES = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  value: GeoIpResult;
  expiresAt: number;
}

/** LRU con TTL: reinserta en el Map para mantener el orden de uso reciente. */
class GeoIpCache {
  private readonly store = new Map<string, CacheEntry>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): GeoIpResult | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: GeoIpResult): void {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }
  }
}

@Injectable()
export class GeoIpService {
  private readonly logger = new Logger(GeoIpService.name);
  private readonly cache = new GeoIpCache(CACHE_MAX_ENTRIES, CACHE_TTL_MS);
  private readerPromise: Promise<Reader<CityResponse> | null> | null = null;
  private hasWarnedUnavailable = false;

  constructor(private readonly config: ConfigService) {}

  private async getReader(): Promise<Reader<CityResponse> | null> {
    if (!this.readerPromise) {
      this.readerPromise = this.loadReader();
    }
    return this.readerPromise;
  }

  private async loadReader(): Promise<Reader<CityResponse> | null> {
    const dbPath = this.config.get<string>('GEOIP_DATABASE_PATH');
    if (!dbPath) {
      this.warnUnavailableOnce(
        'GEOIP_DATABASE_PATH no esta configurado; la geolocalizacion se omitira',
      );
      return null;
    }

    try {
      return await maxmind.open<CityResponse>(dbPath);
    } catch (err) {
      this.warnUnavailableOnce(
        `No se pudo abrir la base GeoLite2 en "${dbPath}": ${
          err instanceof Error ? err.message : 'error desconocido'
        }`,
      );
      return null;
    }
  }

  private warnUnavailableOnce(message: string): void {
    if (this.hasWarnedUnavailable) return;
    this.hasWarnedUnavailable = true;
    this.logger.warn(message);
  }

  async lookup(ip: string): Promise<GeoIpResult> {
    const cached = this.cache.get(ip);
    if (cached) return cached;

    const result = await this.resolve(ip);
    this.cache.set(ip, result);
    return result;
  }

  private async resolve(ip: string): Promise<GeoIpResult> {
    try {
      if (!maxmind.validate(ip)) return UNKNOWN_RESULT;

      const reader = await this.getReader();
      if (!reader) return UNKNOWN_RESULT;

      const record = reader.get(ip);
      if (!record) return UNKNOWN_RESULT;

      const country =
        record.country?.names?.en ??
        record.registered_country?.names?.en ??
        null;
      const countryCode =
        record.country?.iso_code ?? record.registered_country?.iso_code ?? null;
      const region = record.subdivisions?.[0]?.names?.en ?? null;
      const city = record.city?.names?.en ?? null;
      const accuracyRadius = record.location?.accuracy_radius ?? null;

      if (!country && !countryCode && !region && !city) return UNKNOWN_RESULT;

      return {
        country,
        countryCode,
        region,
        city,
        accuracyRadius,
        source: 'maxmind_geolite2',
      };
    } catch (err) {
      this.logger.warn(
        `Fallo al resolver GeoIP: ${err instanceof Error ? err.message : 'error desconocido'}`,
      );
      return UNKNOWN_RESULT;
    }
  }
}
