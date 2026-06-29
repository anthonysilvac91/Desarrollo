import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { sha256hex } from '../common/crypto.util';

const prismaMock = {
  invitation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  organization: { findUnique: jest.fn() },
  owner: { findFirst: jest.fn() },
  user: { findFirst: jest.fn(), findUnique: jest.fn() },
};

const emailMock = {
  sendInvitation: jest.fn(),
  isEnabled: jest.fn().mockReturnValue(true),
};
const configMock = { get: jest.fn().mockReturnValue('http://localhost:3000') };

describe('InvitationsService', () => {
  let service: InvitationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: emailMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get<InvitationsService>(InvitationsService);
    jest.clearAllMocks();
    emailMock.isEnabled.mockReturnValue(true);
    emailMock.sendInvitation.mockResolvedValue(undefined);
  });

  // ── validate() ──────────────────────────────────────────────────────────────

  it('validate() con token inexistente lanza BadRequestException', async () => {
    prismaMock.invitation.findUnique.mockResolvedValue(null);
    await expect(service.validate('bad-token')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('validate() con token válido retorna datos de la invitación', async () => {
    const rawToken = 'valid-token';
    prismaMock.invitation.findUnique.mockResolvedValue({
      email: 'test@test.com',
      role: 'WORKER',
      is_used: false,
      expires_at: new Date(Date.now() + 100000),
      organization: { name: 'Test Org', brand_color: '#000' },
    });
    const result = await service.validate(rawToken);
    expect(result.email).toBe('test@test.com');
  });

  // ── AUTH-C3: invitation token hashing ───────────────────────────────────────

  it('AUTH-C3: validate() busca por sha256(token), no por el token en bruto', async () => {
    const rawToken = 'e'.repeat(64);
    const tokenHash = sha256hex(rawToken);

    prismaMock.invitation.findUnique.mockResolvedValue({
      email: 'test@test.com',
      role: 'WORKER',
      is_used: false,
      expires_at: new Date(Date.now() + 100000),
      organization: { name: 'Test Org', brand_color: '#000' },
    });

    await service.validate(rawToken);

    expect(prismaMock.invitation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: tokenHash } }),
    );
  });

  it('AUTH-C3: validate() con token alterado (hash incorrecto) → BadRequestException', async () => {
    prismaMock.invitation.findUnique.mockResolvedValue(null);
    await expect(service.validate('token-alterado')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('AUTH-C3: validate() con token expirado → BadRequestException', async () => {
    const rawToken = 'f'.repeat(64);
    prismaMock.invitation.findUnique.mockResolvedValue({
      email: 'test@test.com',
      role: 'WORKER',
      is_used: false,
      expires_at: new Date(Date.now() - 1000),
      organization: { name: 'Test Org', brand_color: '#000' },
    });
    await expect(service.validate(rawToken)).rejects.toThrow(BadRequestException);
  });

  it('AUTH-C3: validate() con invitación ya usada → BadRequestException', async () => {
    const rawToken = 'g'.repeat(64);
    prismaMock.invitation.findUnique.mockResolvedValue({
      email: 'test@test.com',
      role: 'WORKER',
      is_used: true,
      expires_at: new Date(Date.now() + 100000),
      organization: { name: 'Test Org', brand_color: '#000' },
    });
    await expect(service.validate(rawToken)).rejects.toThrow(BadRequestException);
  });

  it('AUTH-C3: create() almacena sha256(rawToken) en DB, no el rawToken', async () => {
    let storedToken: string | undefined;
    let urlToken: string | undefined;

    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Acme',
      is_active: true,
    });
    prismaMock.invitation.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.invitation.create.mockImplementation((args: any) => {
      storedToken = args.data.token;
      return Promise.resolve({ id: 'inv-new' });
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    emailMock.sendInvitation.mockImplementation(
      (_to: string, _from: string, _org: string, inviteUrl: string) => {
        const match = /token=([^&]+)/.exec(inviteUrl);
        urlToken = match?.[1];
        return Promise.resolve();
      },
    );

    await service.create(
      { email: 'new@test.com', role: 'WORKER' as any },
      { id: 'admin-1', role: 'ADMIN', orgId: 'org-1' },
    );

    expect(urlToken).toBeDefined();
    expect(storedToken).toBeDefined();
    expect(storedToken).not.toBe(urlToken);
    expect(storedToken).toBe(sha256hex(urlToken!));
  });
});
