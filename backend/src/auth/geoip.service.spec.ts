import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeoIpService } from './geoip.service';

const openMock: jest.Mock = jest.fn();
const validateMock: jest.Mock = jest.fn();

jest.mock('maxmind', () => ({
  open: (...args: unknown[]): unknown => openMock(...args) as unknown,
  validate: (...args: unknown[]): unknown => validateMock(...args) as unknown,
}));

describe('GeoIpService', () => {
  let configMock: { get: jest.Mock };

  const buildService = async (dbPath: string | undefined) => {
    configMock = { get: jest.fn().mockReturnValue(dbPath) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoIpService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    return module.get<GeoIpService>(GeoIpService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    validateMock.mockReturnValue(true);
  });

  it('resuelve pais/region/ciudad/accuracy_radius desde un registro MMDB valido', async () => {
    const getMock = jest.fn().mockReturnValue({
      country: { iso_code: 'CL', names: { en: 'Chile' } },
      subdivisions: [{ names: { en: 'Santiago Metropolitan' } }],
      city: { names: { en: 'Santiago' } },
      location: { accuracy_radius: 20 },
    });
    openMock.mockResolvedValue({ get: getMock });

    const service = await buildService('/data/GeoLite2-City.mmdb');
    const result = await service.lookup('190.20.1.1');

    expect(result).toEqual({
      country: 'Chile',
      countryCode: 'CL',
      region: 'Santiago Metropolitan',
      city: 'Santiago',
      accuracyRadius: 20,
      source: 'maxmind_geolite2',
    });
    expect(getMock).toHaveBeenCalledWith('190.20.1.1');
  });

  it('devuelve datos vacios con source "unknown" cuando la IP no tiene registro', async () => {
    const getMock = jest.fn().mockReturnValue(null);
    openMock.mockResolvedValue({ get: getMock });

    const service = await buildService('/data/GeoLite2-City.mmdb');
    const result = await service.lookup('203.0.113.5');

    expect(result.source).toBe('unknown');
    expect(result.country).toBeNull();
    expect(result.city).toBeNull();
  });

  it('no llama a la base MMDB para una IP con formato invalido', async () => {
    validateMock.mockReturnValue(false);
    const service = await buildService('/data/GeoLite2-City.mmdb');

    const result = await service.lookup('not-an-ip');

    expect(result.source).toBe('unknown');
    expect(openMock).not.toHaveBeenCalled();
  });

  it('no bloquea el flujo si GEOIP_DATABASE_PATH no esta configurado', async () => {
    const service = await buildService(undefined);

    const result = await service.lookup('190.20.1.1');

    expect(result.source).toBe('unknown');
    expect(openMock).not.toHaveBeenCalled();
  });

  it('no bloquea el flujo si la base MMDB es invalida o no existe', async () => {
    openMock.mockRejectedValue(new Error('ENOENT: no such file'));
    const service = await buildService('/data/GeoLite2-City.mmdb');

    await expect(service.lookup('190.20.1.1')).resolves.toEqual({
      country: null,
      countryCode: null,
      region: null,
      city: null,
      accuracyRadius: null,
      source: 'unknown',
    });
  });

  it('cachea resultados por IP y no repite el lookup en el reader', async () => {
    const getMock = jest.fn().mockReturnValue({
      country: { iso_code: 'US', names: { en: 'United States' } },
      subdivisions: [{ names: { en: 'Florida' } }],
      city: { names: { en: 'Miami' } },
      location: { accuracy_radius: 5 },
    });
    openMock.mockResolvedValue({ get: getMock });

    const service = await buildService('/data/GeoLite2-City.mmdb');
    await service.lookup('8.8.8.8');
    await service.lookup('8.8.8.8');
    await service.lookup('8.8.8.8');

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('abre la base MMDB una sola vez (singleton lazy) para IPs distintas', async () => {
    const getMock = jest.fn().mockReturnValue(null);
    openMock.mockResolvedValue({ get: getMock });

    const service = await buildService('/data/GeoLite2-City.mmdb');
    await service.lookup('1.1.1.1');
    await service.lookup('2.2.2.2');
    await service.lookup('3.3.3.3');

    expect(openMock).toHaveBeenCalledTimes(1);
  });
});
