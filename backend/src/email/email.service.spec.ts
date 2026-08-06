import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService, DeviceLoginInfo } from './email.service';
import { PrismaService } from '../prisma/prisma.service';

interface SentEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
}

const sendMock = jest.fn<Promise<{ data: unknown; error: null }>, [SentEmail]>(
  () => Promise.resolve({ data: { id: 'email-1' }, error: null }),
);

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService — new device login notice', () => {
  let service: EmailService;

  const prismaMock = {
    emailTemplateSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  const configMock = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        RESEND_API_KEY: 'test-key',
        EMAIL_FROM: 'noreply@fentri.app',
        EMAIL_FROM_NAME: 'Fentri',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return values[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    prismaMock.emailTemplateSetting.findUnique.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  const send = (device: DeviceLoginInfo, lang: 'en' | 'es' = 'es') =>
    service.sendNewDeviceLogin('user@test.com', 'Ana Perez', device, lang);

  const sentHtml = (): string => sendMock.mock.calls[0][0].html;

  it('muestra "Ciudad, Region, Pais" cuando los tres estan presentes', async () => {
    await send({
      city: 'Miami',
      region: 'Florida',
      country: 'United States',
      countryCode: 'US',
      ipAddress: '187.190.12.34',
    });

    expect(sentHtml()).toContain('Miami, Florida, United States');
  });

  it('omite campos vacios sin dejar comas sueltas', async () => {
    await send({
      city: null,
      region: 'Florida',
      country: 'United States',
      ipAddress: '187.190.12.34',
    });

    expect(sentHtml()).toContain('Florida, United States');
  });

  it('muestra solo el pais cuando es el unico dato disponible', async () => {
    await send({
      city: null,
      region: null,
      country: 'Chile',
      ipAddress: '190.20.1.1',
    });

    expect(sentHtml()).toContain('>Chile<');
  });

  it('no repite el mismo valor cuando ciudad y region coinciden', async () => {
    await send({
      city: 'Singapore',
      region: 'Singapore',
      country: 'Singapore',
      ipAddress: '8.8.8.8',
    });

    const html = sentHtml();
    expect(html).toContain('>Singapore<');
    expect(html).not.toContain('Singapore, Singapore');
  });

  it('usa la etiqueta "Ubicacion aproximada" en español', async () => {
    await send(
      {
        city: 'Santiago',
        region: null,
        country: 'Chile',
        ipAddress: '1.1.1.1',
      },
      'es',
    );

    expect(sentHtml()).toContain('Ubicación aproximada');
    expect(sentHtml()).not.toContain('>Ubicación<');
  });

  it('usa la etiqueta "Approximate location" en ingles', async () => {
    await send(
      {
        city: 'Miami',
        region: 'Florida',
        country: 'United States',
        ipAddress: '1.1.1.1',
      },
      'en',
    );

    expect(sentHtml()).toContain('Approximate location');
  });

  it('siempre muestra la IP cuando existe', async () => {
    await send({
      city: null,
      region: null,
      country: null,
      ipAddress: '201.55.10.2',
    });

    expect(sentHtml()).toContain('201.55.10.2');
  });
});
