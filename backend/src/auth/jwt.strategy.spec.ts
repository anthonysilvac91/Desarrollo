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

  const payload = { sub: 'user-1' };

  it('JWT válido pero usuario no existe => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('JWT válido pero user.is_active=false => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'ADMIN',
      organization_id: 'org-1',
      owner_id: null,
      is_active: false,
      organization: { id: 'org-1', is_active: true },
    });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('JWT válido pero user.role cambió en DB => req.user usa rol de DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'WORKER',
      organization_id: 'org-1',
      owner_id: null,
      is_active: true,
      organization: { id: 'org-1', is_active: true },
    });
    const result = await strategy.validate({ sub: 'user-1', role: 'ADMIN' });
    expect(result.role).toBe('WORKER');
    expect(result.api_role).toBe('WORKER');
  });

  it('JWT válido pero user.organization_id cambió en DB => req.user usa organization_id de DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'ADMIN',
      organization_id: 'org-new',
      owner_id: null,
      is_active: true,
      organization: { id: 'org-new', is_active: true },
    });
    const result = await strategy.validate({ sub: 'user-1', orgId: 'org-old' });
    expect(result.orgId).toBe('org-new');
  });

  it('Usuario no SUPER_ADMIN sin organization_id => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'ADMIN',
      organization_id: null,
      owner_id: null,
      is_active: true,
      organization: null,
    });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('Usuario no SUPER_ADMIN con Organization inactiva => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'ADMIN',
      organization_id: 'org-1',
      owner_id: null,
      is_active: true,
      organization: { id: 'org-1', is_active: false },
    });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('SUPER_ADMIN con organization_id null => permitido, orgId=null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'SUPER_ADMIN',
      organization_id: null,
      owner_id: null,
      is_active: true,
      organization: null,
    });
    const result = await strategy.validate(payload);
    expect(result.orgId).toBeNull();
    expect(result.owner_id).toBeNull();
    expect(result.role).toBe('SUPER_ADMIN');
  });

  it('SUPER_ADMIN con organization_id no null => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'SUPER_ADMIN',
      organization_id: 'org-1',
      owner_id: null,
      is_active: true,
      organization: { id: 'org-1', is_active: true },
    });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('EXTERNAL sin owner_id => Unauthorized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'EXTERNAL',
      organization_id: 'org-1',
      owner_id: null,
      is_active: true,
      organization: { id: 'org-1', is_active: true },
    });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('EXTERNAL con owner_id => permitido, owner_id viene de DB no del JWT', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'EXTERNAL',
      organization_id: 'org-1',
      owner_id: 'owner-db',
      is_active: true,
      organization: { id: 'org-1', is_active: true },
    });
    const result = await strategy.validate({ sub: 'user-1', owner_id: 'owner-jwt' });
    expect(result.owner_id).toBe('owner-db');
    expect(result.orgId).toBe('org-1');
  });
});
