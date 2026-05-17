import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { StoredFilesService } from '../storage/stored-files.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const prismaMock = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
  };
  const jwtMock = { sign: jest.fn().mockReturnValue('mocked-token') };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtMock.sign.mockReturnValue('mocked-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: StoredFilesService, useValue: { resolveFileUrl: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  // ─── helpers ────────────────────────────────────────────────────────────────

  const makeUser = (overrides: object = {}) => ({
    id: 'u-1',
    email: 'user@test.com',
    role: 'ADMIN',
    organization_id: 'org-1',
    owner_id: null,
    is_active: true,
    password_hash: 'hash-placeholder',
    organization: { id: 'org-1', is_active: true },
    ...overrides,
  });

  const makeSuperAdmin = (overrides: object = {}) => ({
    id: 'u-super',
    email: 'sa@test.com',
    role: 'SUPER_ADMIN',
    organization_id: null,
    owner_id: null,
    is_active: true,
    password_hash: 'hash-placeholder',
    organization: null,
    ...overrides,
  });

  // ─── login() ────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('email inexistente falla con Unauthorized', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      await expect(service.login({ email: 'no@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('password incorrecto falla con Unauthorized', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findFirst.mockResolvedValue(makeUser({ password_hash: hash }));
      await expect(service.login({ email: 'user@test.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('usuario inactivo falla con Unauthorized', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(makeUser({ password_hash: hash, is_active: false }));
      await expect(service.login({ email: 'user@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('SUPER_ADMIN login con email + password funciona', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(makeSuperAdmin({ password_hash: hash }));

      const result = await service.login({ email: 'sa@test.com', password: 'pass' });

      expect(result.access_token).toBe('mocked-token');
      expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u-super', orgId: null, role: 'SUPER_ADMIN', owner_id: null });
    });

    it('SUPER_ADMIN con organization_id no null no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeSuperAdmin({ password_hash: hash, organization_id: 'org-1' }),
      );
      await expect(service.login({ email: 'sa@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('ADMIN login con email + password funciona y token usa organization_id real de DB', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'ADMIN', password_hash: hash, organization_id: 'org-real' }),
      );

      const result = await service.login({ email: 'admin@test.com', password: 'pass' });

      expect(result.access_token).toBe('mocked-token');
      expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-real', role: 'ADMIN' }));
    });

    it('WORKER login con email + password funciona y token usa organization_id real de DB', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'WORKER', password_hash: hash, organization_id: 'org-real' }),
      );

      const result = await service.login({ email: 'worker@test.com', password: 'pass' });

      expect(result.access_token).toBe('mocked-token');
      expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-real', role: 'WORKER' }));
    });

    it('EXTERNAL login con email + password funciona y token usa organization_id/owner_id reales de DB', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'EXTERNAL', password_hash: hash, organization_id: 'org-real', owner_id: 'owner-db' }),
      );

      const result = await service.login({ email: 'ext@test.com', password: 'pass' });

      expect(result.access_token).toBe('mocked-token');
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u-1',
        orgId: 'org-real',
        role: 'EXTERNAL',
        owner_id: 'owner-db',
      });
    });

    it('ADMIN sin organization_id en DB no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'ADMIN', password_hash: hash, organization_id: null, organization: null }),
      );
      await expect(service.login({ email: 'admin@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('WORKER sin organization_id en DB no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'WORKER', password_hash: hash, organization_id: null, organization: null }),
      );
      await expect(service.login({ email: 'worker@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('EXTERNAL sin organization_id en DB no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'EXTERNAL',
          password_hash: hash,
          organization_id: null,
          organization: null,
          owner_id: 'owner-1',
        }),
      );
      await expect(service.login({ email: 'ext@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Organization inactiva bloquea ADMIN', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'ADMIN', password_hash: hash, organization: { id: 'org-1', is_active: false } }),
      );
      await expect(service.login({ email: 'admin@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Organization inactiva bloquea WORKER', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'WORKER', password_hash: hash, organization: { id: 'org-1', is_active: false } }),
      );
      await expect(service.login({ email: 'worker@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Organization inactiva bloquea EXTERNAL', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'EXTERNAL',
          password_hash: hash,
          owner_id: 'owner-1',
          organization: { id: 'org-1', is_active: false },
        }),
      );
      await expect(service.login({ email: 'ext@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('EXTERNAL sin owner_id no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'EXTERNAL', password_hash: hash, owner_id: null }),
      );
      await expect(service.login({ email: 'ext@test.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('Login no usa slug — findFirst busca por email sin slug', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      await service.login({ email: 'x@test.com', password: 'pass' }).catch(() => {});
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'x@test.com' } }),
      );
      expect(prismaMock.user.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ slug: expect.anything() }) }),
      );
    });

    it('Login no usa subdominio — LoginDto solo acepta email y password', async () => {
      // Verificación estática: LoginDto no tiene campo subdomain ni slug
      // El servicio solo llama findFirst con { email }
      prismaMock.user.findFirst.mockResolvedValue(null);
      await service.login({ email: 'x@test.com', password: 'pass' }).catch(() => {});
      const callArg = prismaMock.user.findFirst.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('subdomain');
      expect(callArg.where).not.toHaveProperty('slug');
    });

    it('JWT usa role/orgId/owner_id reales de DB, no de input del cliente', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          id: 'u-db',
          role: 'EXTERNAL',
          password_hash: hash,
          organization_id: 'org-db',
          owner_id: 'owner-db',
          organization: { id: 'org-db', is_active: true },
        }),
      );

      await service.login({ email: 'ext@test.com', password: 'pass' });

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u-db',
        orgId: 'org-db',
        role: 'EXTERNAL',
        owner_id: 'owner-db',
      });
    });
  });

  // ─── register() — MVP disabled ───────────────────────────────────────────────

  describe('register()', () => {
    it('POST /auth/register devuelve ForbiddenException — disabled para MVP', async () => {
      await expect(service.register({ token: 'any-token' })).rejects.toThrow(ForbiddenException);
      await expect(service.register({ token: 'any-token' })).rejects.toThrow(
        'Registration by invitation is disabled for MVP',
      );
    });
  });

  // ─── getMe() ────────────────────────────────────────────────────────────────

  describe('getMe()', () => {
    it('devuelve owner_id sin company_id/customer_id', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u-3',
        organization_id: 'org-3',
        role: 'EXTERNAL',
        password_hash: 'hash',
        owner_id: 'owner-2',
        avatar_file_id: null,
        organization: null,
      });
      jest.spyOn((service as any).storedFilesService, 'resolveFileUrl').mockResolvedValue(null);

      const result = await service.getMe('u-3');

      expect(result.role).toBe('EXTERNAL');
      expect(result.owner_id).toBe('owner-2');
      expect((result as any).company_id).toBeUndefined();
      expect((result as any).customer_id).toBeUndefined();
    });
  });
});
