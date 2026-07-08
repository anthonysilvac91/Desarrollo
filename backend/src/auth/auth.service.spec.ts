import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StoredFilesService } from '../storage/stored-files.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';
import { sha256hex, aesGcmEncrypt, aesGcmDecrypt } from '../common/crypto.util';

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
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pendingTotpSetup: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
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
    sendTwoFactorCode: jest.fn(),
    sendWelcome: jest.fn(),
    sendNewDeviceLogin: jest.fn().mockResolvedValue(undefined),
    sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
    sendTwoFactorStatusChanged: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
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
    prismaMock.pendingTotpSetup.upsert.mockResolvedValue({});
    prismaMock.pendingTotpSetup.update.mockResolvedValue({});
    prismaMock.emailToken.deleteMany.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (ops) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops(prismaMock);
    });

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

  // ─── AUTH-C4: TOTP setup token no contiene secret ────────────────────────────

  describe('setupTwoFactor() — AUTH-C4', () => {
    const user2fa = makeUser({
      id: 'u-2fa',
      email: '2fa@test.com',
      two_factor_enabled: false,
    });

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(user2fa);
    });

    it('JWT de setup no contiene el campo secret', async () => {
      await service.setupTwoFactor('u-2fa');
      const signCall = (jwt.sign as jest.Mock).mock.calls[0][0];
      expect(signCall).not.toHaveProperty('secret');
      expect(signCall.purpose).toBe('2fa_setup');
    });

    it('secret pendiente se persiste en DB (pendingTotpSetup.upsert), no en el JWT', async () => {
      await service.setupTwoFactor('u-2fa');
      expect(prismaMock.pendingTotpSetup.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'u-2fa' },
          create: expect.objectContaining({
            user_id: 'u-2fa',
            encrypted_secret: expect.any(String),
            expires_at: expect.any(Date),
          }),
        }),
      );
    });

    it('encrypted_secret en DB no es el secret en texto plano', async () => {
      let capturedEncryptedSecret: string | undefined;
      prismaMock.pendingTotpSetup.upsert.mockImplementation((args: any) => {
        capturedEncryptedSecret = args.create.encrypted_secret;
        return Promise.resolve({});
      });

      const result = await service.setupTwoFactor('u-2fa');
      const rawSecret = (result as any).secret;

      expect(capturedEncryptedSecret).toBeDefined();
      expect(capturedEncryptedSecret).not.toBe(rawSecret);
    });
  });

  describe('verifyTwoFactorSetup() — AUTH-C4', () => {
    const encKey = 'http://localhost:3000';

    const makePending = (overrides: object = {}) => ({
      id: 'pending-1',
      user_id: 'u-1',
      encrypted_secret: aesGcmEncrypt('JBSWY3DPEHPK3PXP', encKey),
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      consumed_at: null,
      created_at: new Date(),
      ...overrides,
    });

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(
        makeUser({ id: 'u-1', two_factor_enabled: false }),
      );
      (jwt as any).verify = jest.fn().mockReturnValue({
        sub: 'u-1',
        purpose: '2fa_setup',
      });
    });

    it('setup expirado falla con BadRequestException', async () => {
      prismaMock.pendingTotpSetup.findUnique.mockResolvedValue(
        makePending({ expires_at: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.verifyTwoFactorSetup('u-1', 'setup-token', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('setup ya consumido falla con BadRequestException', async () => {
      prismaMock.pendingTotpSetup.findUnique.mockResolvedValue(
        makePending({ consumed_at: new Date() }),
      );
      await expect(
        service.verifyTwoFactorSetup('u-1', 'setup-token', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('setup inexistente falla con BadRequestException', async () => {
      prismaMock.pendingTotpSetup.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyTwoFactorSetup('u-1', 'setup-token', '000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('token JWT con purpose incorrecto falla con BadRequestException', async () => {
      (jwt as any).verify = jest.fn().mockReturnValue({
        sub: 'u-1',
        purpose: '2fa_login',
      });
      prismaMock.pendingTotpSetup.findUnique.mockResolvedValue(makePending());
      await expect(
        service.verifyTwoFactorSetup('u-1', 'bad-token', '000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('two_factor_secret almacenado es cifrado (no coincide con el seed TOTP)', async () => {
      let storedSecret: string | undefined;
      prismaMock.user.update.mockImplementation((args: any) => {
        storedSecret = args.data.two_factor_secret;
        return Promise.resolve({});
      });
      prismaMock.pendingTotpSetup.findUnique.mockResolvedValue(makePending());
      prismaMock.pendingTotpSetup.update.mockResolvedValue({});

      // Use a spy to make verifyTotpCode return true
      jest
        .spyOn(service as any, 'decryptTotpSecret')
        .mockReturnValue('JBSWY3DPEHPK3PXP');
      jest.spyOn(require('./totp.util'), 'verifyTotpCode').mockReturnValue(true);
      jest.spyOn(require('bcryptjs'), 'hash').mockResolvedValue('hashed-backup');

      await service.verifyTwoFactorSetup('u-1', 'setup-token', '123456');

      expect(storedSecret).toBeDefined();
      expect(storedSecret).not.toBe('JBSWY3DPEHPK3PXP');
    });

    it('consumed_at se registra al confirmar el setup', async () => {
      prismaMock.pendingTotpSetup.findUnique.mockResolvedValue(makePending());
      prismaMock.pendingTotpSetup.update.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({});

      jest
        .spyOn(service as any, 'decryptTotpSecret')
        .mockReturnValue('JBSWY3DPEHPK3PXP');
      jest.spyOn(require('./totp.util'), 'verifyTotpCode').mockReturnValue(true);
      jest.spyOn(require('bcryptjs'), 'hash').mockResolvedValue('hashed-backup');

      await service.verifyTwoFactorSetup('u-1', 'setup-token', '123456');

      expect(prismaMock.pendingTotpSetup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'u-1' },
          data: { consumed_at: expect.any(Date) },
        }),
      );
    });
  });

  // ─── AUTH-C3: tokens de reset e invitación hasheados ─────────────────────────

  describe('forgotPassword() — AUTH-C3', () => {
    beforeEach(() => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return 'http://localhost:3000';
      });
      prismaMock.user.findFirst.mockResolvedValue(makeUser({ email: 'u@test.com' }));
      prismaMock.emailToken.updateMany.mockResolvedValue({});
      prismaMock.emailToken.create.mockResolvedValue({});
      (emailMock as any).sendPasswordReset = jest.fn();
    });

    it('token almacenado en DB es el hash SHA-256, no el token en bruto', async () => {
      let storedToken: string | undefined;
      let urlToken: string | undefined;

      prismaMock.emailToken.create.mockImplementation((args: any) => {
        storedToken = args.data.token;
        return Promise.resolve({ id: 'et-1' });
      });
      (emailMock as any).sendPasswordReset.mockImplementation(
        (_email: string, _name: string, url: string) => {
          const match = /token=([^&]+)/.exec(url);
          urlToken = match?.[1];
          return Promise.resolve();
        },
      );

      await service.forgotPassword('u@test.com');

      expect(urlToken).toBeDefined();
      expect(storedToken).toBeDefined();
      expect(storedToken).not.toBe(urlToken);
      expect(storedToken).toBe(sha256hex(urlToken!));
    });
  });

  describe('resetPassword() — AUTH-C3', () => {
    it('token válido (hash coincide) → contraseña actualizada', async () => {
      const rawToken = 'a'.repeat(64);
      const hashToken = sha256hex(rawToken);

      prismaMock.emailToken.findUnique.mockResolvedValue({
        id: 'et-1',
        user_id: 'u-1',
        type: 'PASSWORD_RESET',
        token: hashToken,
        used_at: null,
        expires_at: new Date(Date.now() + 60000),
      });
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.emailToken.update.mockResolvedValue({});
      prismaMock.userSession.updateMany.mockResolvedValue({});

      const result = await service.resetPassword(rawToken, 'newpassword123');
      expect(result.message).toContain('Contraseña');
      expect(prismaMock.emailToken.findUnique).toHaveBeenCalledWith({
        where: { token: hashToken },
      });
    });

    it('token alterado (hash no coincide) → BadRequestException', async () => {
      prismaMock.emailToken.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword('token-alterado', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('token expirado → BadRequestException', async () => {
      const rawToken = 'b'.repeat(64);
      prismaMock.emailToken.findUnique.mockResolvedValue({
        id: 'et-2',
        user_id: 'u-1',
        type: 'PASSWORD_RESET',
        token: sha256hex(rawToken),
        used_at: null,
        expires_at: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword(rawToken, 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('token ya usado → BadRequestException', async () => {
      const rawToken = 'c'.repeat(64);
      prismaMock.emailToken.findUnique.mockResolvedValue({
        id: 'et-3',
        user_id: 'u-1',
        type: 'PASSWORD_RESET',
        token: sha256hex(rawToken),
        used_at: new Date(),
        expires_at: new Date(Date.now() + 60000),
      });
      await expect(
        service.resetPassword(rawToken, 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('register() con invitation — AUTH-C3', () => {
    it('busca invitación por sha256(token), no por el token en bruto', async () => {
      const rawToken = 'd'.repeat(64);
      const tokenHash = sha256hex(rawToken);

      prismaMock.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'newuser@test.com',
        role: 'WORKER',
        is_used: false,
        expires_at: new Date(Date.now() + 100000),
        owner_id: null,
        organization_id: 'org-1',
        organization: { id: 'org-1', name: 'Org', is_active: true },
      });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(makeUser({ id: 'new-u' }));
      prismaMock.invitation.update.mockResolvedValue({});
      prismaMock.$transaction.mockResolvedValue([makeUser({ id: 'new-u' }), {}]);
      prismaMock.userSession.create.mockResolvedValue({ id: 's-1', token_jti: 'j-1' });

      await service.register({ token: rawToken, name: 'New User', password: 'pass123' });

      expect(prismaMock.invitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: tokenHash } }),
      );
    });
  });

  // ─── DB-C2: cifrado AES-256-GCM ──────────────────────────────────────────────

  describe('Cifrado AES-256-GCM (crypto.util)', () => {
    const key = 'test-encryption-key-for-tests';

    it('aesGcmEncrypt produce valor distinto al secreto original', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = aesGcmEncrypt(secret, key);
      expect(encrypted).not.toBe(secret);
    });

    it('aesGcmDecrypt recupera el secreto original', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = aesGcmEncrypt(secret, key);
      const decrypted = aesGcmDecrypt(encrypted, key);
      expect(decrypted).toBe(secret);
    });

    it('datos alterados en el ciphertext fallan autenticación GCM', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = aesGcmEncrypt(secret, key);
      const parts = encrypted.split('.');
      // Alterar el ciphertext
      const corruptedCiphertext = Buffer.from(
        parts[2],
        'base64',
      ).fill(0).toString('base64');
      const tampered = `${parts[0]}.${parts[1]}.${corruptedCiphertext}`;
      expect(() => aesGcmDecrypt(tampered, key)).toThrow();
    });

    it('formato inválido lanza error', () => {
      expect(() => aesGcmDecrypt('not.valid', key)).toThrow();
    });
  });
});
