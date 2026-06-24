import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StoredFilesService } from '../storage/stored-files.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    organization: { findUnique: jest.fn(), create: jest.fn() },
    userSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    invitation: { findUnique: jest.fn(), update: jest.fn() },
    emailToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const jwtMock = { sign: jest.fn().mockReturnValue('mocked-token') };
  const configMock = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  };
  const emailMock = {
    sendPasswordReset: jest.fn(),
    sendEmailVerification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtMock.sign.mockReturnValue('mocked-token');
    prismaMock.organization.findUnique.mockResolvedValue(null);
    prismaMock.userSession.findFirst.mockResolvedValue(null);
    prismaMock.userSession.create.mockResolvedValue({
      id: 'session-1',
      token_jti: 'jti-1',
    });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        {
          provide: StoredFilesService,
          useValue: { resolveFileUrl: jest.fn() },
        },
        { provide: EmailService, useValue: emailMock },
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
      await expect(
        service.login({ email: 'no@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('password incorrecto falla con Unauthorized', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ password_hash: hash }),
      );
      await expect(
        service.login({ email: 'user@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('usuario inactivo falla con Unauthorized', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ password_hash: hash, is_active: false }),
      );
      await expect(
        service.login({ email: 'user@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('SUPER_ADMIN login con email + password funciona', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeSuperAdmin({ password_hash: hash }),
      );

      const result = await service.login({
        email: 'sa@test.com',
        password: 'pass',
      });

      expect(result.access_token).toBe('mocked-token');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u-super' },
        data: { last_login_at: expect.any(Date) },
      });
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u-super',
        orgId: null,
        role: 'SUPER_ADMIN',
        owner_id: null,
        sid: 'session-1',
        jti: 'jti-1',
      });
    });

    it('SUPER_ADMIN con organization_id no null no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeSuperAdmin({ password_hash: hash, organization_id: 'org-1' }),
      );
      await expect(
        service.login({ email: 'sa@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('ADMIN login con email + password funciona y token usa organization_id real de DB', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'ADMIN',
          password_hash: hash,
          organization_id: 'org-real',
        }),
      );

      const result = await service.login({
        email: 'admin@test.com',
        password: 'pass',
      });

      expect(result.access_token).toBe('mocked-token');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { last_login_at: expect.any(Date) },
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-real', role: 'ADMIN' }),
      );
    });

    it('WORKER login con email + password funciona y token usa organization_id real de DB', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'WORKER',
          password_hash: hash,
          organization_id: 'org-real',
        }),
      );

      const result = await service.login({
        email: 'worker@test.com',
        password: 'pass',
      });

      expect(result.access_token).toBe('mocked-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'org-real', role: 'WORKER' }),
      );
    });

    it('EXTERNAL login con email + password funciona y token usa organization_id/owner_id reales de DB', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'EXTERNAL',
          password_hash: hash,
          organization_id: 'org-real',
          owner_id: 'owner-db',
        }),
      );

      const result = await service.login({
        email: 'ext@test.com',
        password: 'pass',
      });

      expect(result.access_token).toBe('mocked-token');
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u-1',
        orgId: 'org-real',
        role: 'EXTERNAL',
        owner_id: 'owner-db',
        sid: 'session-1',
        jti: 'jti-1',
      });
    });

    it('ADMIN sin organization_id en DB no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'ADMIN',
          password_hash: hash,
          organization_id: null,
          organization: null,
        }),
      );
      await expect(
        service.login({ email: 'admin@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('WORKER sin organization_id en DB no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'WORKER',
          password_hash: hash,
          organization_id: null,
          organization: null,
        }),
      );
      await expect(
        service.login({ email: 'worker@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
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
      await expect(
        service.login({ email: 'ext@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Organization inactiva bloquea ADMIN', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'ADMIN',
          password_hash: hash,
          organization: { id: 'org-1', is_active: false },
        }),
      );
      await expect(
        service.login({ email: 'admin@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Organization inactiva bloquea WORKER', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({
          role: 'WORKER',
          password_hash: hash,
          organization: { id: 'org-1', is_active: false },
        }),
      );
      await expect(
        service.login({ email: 'worker@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
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
      await expect(
        service.login({ email: 'ext@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('EXTERNAL sin owner_id no entra', async () => {
      const hash = await bcrypt.hash('pass', 10);
      prismaMock.user.findFirst.mockResolvedValue(
        makeUser({ role: 'EXTERNAL', password_hash: hash, owner_id: null }),
      );
      await expect(
        service.login({ email: 'ext@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Login no usa slug — findFirst busca por email sin slug', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      await service
        .login({ email: 'x@test.com', password: 'pass' })
        .catch(() => {});
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'x@test.com' } }),
      );
      expect(prismaMock.user.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ slug: expect.anything() }),
        }),
      );
    });

    it('Login no usa subdominio — LoginDto solo acepta email y password', async () => {
      // Verificación estática: LoginDto no tiene campo subdomain ni slug
      // El servicio solo llama findFirst con { email }
      prismaMock.user.findFirst.mockResolvedValue(null);
      await service
        .login({ email: 'x@test.com', password: 'pass' })
        .catch(() => {});
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
        sid: 'session-1',
        jti: 'jti-1',
      });
    });
  });

  // ─── register() — token inválido ─────────────────────────────────────────────

  describe('register()', () => {
    it('POST /auth/register con token inválido devuelve BadRequestException', async () => {
      prismaMock.invitation.findUnique.mockResolvedValue(null);
      await expect(
        service.register({
          token: 'invalid-token',
          name: 'Test User',
          password: 'password123',
        }),
      ).rejects.toThrow('Token de invitación inválido o expirado');
    });
  });

  // ─── getMe() ────────────────────────────────────────────────────────────────

  describe('registerOrganization()', () => {
    it('crea organizacion activa, usuario ADMIN y retorna access_token', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.organization.create.mockResolvedValue({
        id: 'org-new',
        name: 'Acme Services',
        slug: 'acme-services-abc123',
        is_active: true,
      });
      prismaMock.user.create.mockResolvedValue(
        makeUser({
          id: 'admin-new',
          email: 'admin@acme.com',
          name: 'Admin User',
          role: 'ADMIN',
          organization_id: 'org-new',
        }),
      );

      const result = await service.registerOrganization({
        organization_name: 'Acme Services',
        admin_name: 'Admin User',
        email: 'ADMIN@ACME.COM',
        password: 'password123',
      });

      expect(prismaMock.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Acme Services',
          is_active: true,
        }),
        select: {
          id: true,
          name: true,
          slug: true,
          is_active: true,
        },
      });
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'admin@acme.com',
          name: 'Admin User',
          role: 'ADMIN',
          organization_id: 'org-new',
          owner_id: null,
        }),
      });
      expect(result.access_token).toBe('mocked-token');
      expect(result.organization).toEqual({
        id: 'org-new',
        name: 'Acme Services',
        slug: 'acme-services-abc123',
        is_active: true,
      });
    });

    it('rechaza emails ya registrados', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        makeUser({ email: 'admin@acme.com' }),
      );

      await expect(
        service.registerOrganization({
          organization_name: 'Acme Services',
          admin_name: 'Admin User',
          email: 'admin@acme.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.organization.create).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

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
      jest
        .spyOn((service as any).storedFilesService, 'resolveFileUrl')
        .mockResolvedValue(null);

      const result = await service.getMe('u-3');

      expect(result.role).toBe('EXTERNAL');
      expect(result.owner_id).toBe('owner-2');
      expect((result as any).company_id).toBeUndefined();
      expect((result as any).customer_id).toBeUndefined();
    });
  });
});
