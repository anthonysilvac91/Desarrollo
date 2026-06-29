import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

const mockConfigService = { get: jest.fn().mockReturnValue('test-secret') };
const mockPrisma = {
  user: { findUnique: jest.fn() },
  userSession: { findFirst: jest.fn(), update: jest.fn() },
};

const SESSION = { id: 'session-1' };
const validPayload = { sub: 'user-1', sid: 'session-1', jti: 'jti-1' };

const activeUser = (overrides: object = {}) => ({
  id: 'user-1',
  role: 'ADMIN',
  organization_id: 'org-1',
  owner_id: null,
  is_active: true,
  organization: { id: 'org-1', is_active: true },
  ...overrides,
});

describe('JwtStrategy.validate()', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  // ── AUTH-C1 / AUTH-H2 regression tests ──────────────────────────────────────

  it('AUTH-C1: token con purpose="2fa_login" => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeUser());
    await expect(
      strategy.validate({ sub: 'user-1', purpose: '2fa_login' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('AUTH-C1: token con purpose="2fa_setup" => Unauthorized', async () => {
    await expect(
      strategy.validate({ sub: 'user-1', purpose: '2fa_setup', secret: 'abc' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('AUTH-H2: token sin sid => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeUser());
    await expect(
      strategy.validate({ sub: 'user-1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('AUTH-H2: token sin jti => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeUser());
    await expect(
      strategy.validate({ sub: 'user-1', sid: 'session-1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('sid presente pero sesión no existe en DB => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeUser());
    mockPrisma.userSession.findFirst.mockResolvedValue(null);
    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('sid presente pero sesión revocada (findFirst retorna null) => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeUser());
    mockPrisma.userSession.findFirst.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'user-1', sid: 'revoked-session', jti: 'jti-1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── Tests de usuario y organización (ahora con sid+jti) ─────────────────────

  it('JWT válido pero usuario no existe => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('JWT válido pero user.is_active=false => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeUser({ is_active: false }));
    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('JWT válido pero user.role cambió en DB => req.user usa rol de DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeUser({ role: 'WORKER' }));
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    const result = await strategy.validate({ ...validPayload, role: 'ADMIN' });
    expect(result.role).toBe('WORKER');
    expect(result.api_role).toBe('WORKER');
  });

  it('JWT válido pero user.organization_id cambió en DB => req.user usa organization_id de DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      activeUser({ organization_id: 'org-new', organization: { id: 'org-new', is_active: true } }),
    );
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    const result = await strategy.validate({ ...validPayload, orgId: 'org-old' });
    expect(result.orgId).toBe('org-new');
  });

  it('Usuario no SUPER_ADMIN sin organization_id => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      activeUser({ role: 'ADMIN', organization_id: null, organization: null }),
    );
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Usuario no SUPER_ADMIN con Organization inactiva => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      activeUser({ organization: { id: 'org-1', is_active: false } }),
    );
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('SUPER_ADMIN con organization_id null => permitido, orgId=null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      activeUser({ role: 'SUPER_ADMIN', organization_id: null, organization: null }),
    );
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    const result = await strategy.validate(validPayload);
    expect(result.orgId).toBeNull();
    expect(result.owner_id).toBeNull();
    expect(result.role).toBe('SUPER_ADMIN');
  });

  it('SUPER_ADMIN con organization_id no null => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      activeUser({ role: 'SUPER_ADMIN', organization_id: 'org-1' }),
    );
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('EXTERNAL sin owner_id => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      activeUser({ role: 'EXTERNAL', owner_id: null }),
    );
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('EXTERNAL con owner_id => permitido, owner_id viene de DB no del JWT', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      activeUser({ role: 'EXTERNAL', owner_id: 'owner-db' }),
    );
    mockPrisma.userSession.findFirst.mockResolvedValue(SESSION);
    mockPrisma.userSession.update.mockResolvedValue({});
    const result = await strategy.validate({
      ...validPayload,
      owner_id: 'owner-jwt',
    });
    expect(result.owner_id).toBe('owner-db');
    expect(result.orgId).toBe('org-1');
  });
});
