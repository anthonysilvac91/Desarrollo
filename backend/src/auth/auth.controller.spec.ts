import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { signTrustedClientIpPayload } from './trusted-client-ip.util';

const AUTH_COOKIE_NAME = 'access_token';
const ACCESS_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const HMAC_SECRET = 'test-hmac-secret';

describe('AuthController cookie session', () => {
  const authService = {
    login: jest.fn(),
    loginWithTwoFactor: jest.fn(),
    loginWithEmailCode: jest.fn(),
    register: jest.fn(),
    registerOrganization: jest.fn(),
    logout: jest.fn(),
  } as unknown as AuthService;

  let authProxySecret: string | undefined;
  const configService = {
    get: jest.fn((key: string) =>
      key === 'AUTH_PROXY_HMAC_SECRET' ? authProxySecret : undefined,
    ),
  } as unknown as ConfigService;

  type LoginRequest = Parameters<AuthController['login']>[1];
  type LoginResponse = Parameters<AuthController['login']>[2];
  type LogoutRequest = Parameters<AuthController['logout']>[0];
  type LogoutResponse = Parameters<AuthController['logout']>[1];

  const req = {
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as LoginRequest;

  let controller: AuthController;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    authProxySecret = HMAC_SECRET;
    controller = new AuthController(authService, configService);
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('login establece cookie httpOnly y no devuelve access_token', async () => {
    jest
      .spyOn(authService, 'login')
      .mockResolvedValue({ access_token: 'jwt-token' });

    const body = await controller.login(
      { email: 'admin@test.com', password: '123456' },
      req,
      res as unknown as LoginResponse,
    );

    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'jwt-token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: ACCESS_TOKEN_TTL_MS,
      }),
    );
    expect(body).toEqual({});
  });

  it('usa Secure en produccion', async () => {
    process.env.NODE_ENV = 'production';
    jest
      .spyOn(authService, 'login')
      .mockResolvedValue({ access_token: 'jwt-token' });

    await controller.login(
      { email: 'admin@test.com', password: '123456' },
      req,
      res as unknown as LoginResponse,
    );

    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'jwt-token',
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
  });

  it('2FA pendiente no establece cookie', async () => {
    jest.spyOn(authService, 'login').mockResolvedValue({
      requires_2fa: true,
      temporary_token: 'temporary',
      method: 'app',
    });

    const body = await controller.login(
      { email: 'admin@test.com', password: '123456' },
      req,
      res as unknown as LoginResponse,
    );

    expect(res.cookie).not.toHaveBeenCalled();
    expect(body).toEqual({
      requires_2fa: true,
      temporary_token: 'temporary',
      method: 'app',
    });
  });

  it('logout revoca sesion y limpia cookie desde servidor', async () => {
    jest.spyOn(authService, 'logout').mockResolvedValue({ revoked: true });

    const body = await controller.logout(
      {
        user: { id: 'user-1', session_id: 'session-1' },
      } as unknown as LogoutRequest,
      res as unknown as LogoutResponse,
    );

    expect(body).toEqual({ revoked: true });
    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  describe('captura de IP del request', () => {
    const loginBody = { email: 'admin@test.com', password: '123456' };

    it('prioriza x-real-ip sobre cualquier otro origen', async () => {
      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ access_token: 'jwt-token' });

      const spoofedReq = {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '203.0.113.9',
        },
        ip: '10.0.0.5',
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as LoginRequest;

      await controller.login(
        loginBody,
        spoofedReq,
        res as unknown as LoginResponse,
      );

      expect(loginSpy).toHaveBeenCalledWith(
        loginBody,
        expect.objectContaining({ ipAddress: '203.0.113.9' }),
      );
    });

    it('no usa directamente el primer valor de x-forwarded-for cuando no hay x-real-ip', async () => {
      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ access_token: 'jwt-token' });

      const spoofedReq = {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        ip: '10.0.0.5',
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as LoginRequest;

      await controller.login(
        loginBody,
        spoofedReq,
        res as unknown as LoginResponse,
      );

      const context = loginSpy.mock.calls[0][1];
      expect(context?.ipAddress).not.toBe('1.2.3.4');
      expect(context?.ipAddress).toBe('10.0.0.5');
    });

    it('usa req.socket.remoteAddress como ultimo recurso', async () => {
      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ access_token: 'jwt-token' });

      const reqWithoutIp = {
        headers: {},
        ip: undefined,
        socket: { remoteAddress: '198.51.100.7' },
      } as unknown as LoginRequest;

      await controller.login(
        loginBody,
        reqWithoutIp,
        res as unknown as LoginResponse,
      );

      expect(loginSpy).toHaveBeenCalledWith(
        loginBody,
        expect.objectContaining({ ipAddress: '198.51.100.7' }),
      );
    });

    it('usa x-fentri-client-ip cuando la firma HMAC es valida (prioridad maxima)', async () => {
      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ access_token: 'jwt-token' });

      const timestamp = String(Date.now());
      const clientIp = '186.11.74.13';
      const signature = signTrustedClientIpPayload(
        'POST',
        '/auth/login',
        timestamp,
        clientIp,
        HMAC_SECRET,
      );

      const signedReq = {
        method: 'POST',
        originalUrl: '/auth/login',
        headers: {
          'x-fentri-client-ip': clientIp,
          'x-fentri-proxy-timestamp': timestamp,
          'x-fentri-proxy-signature': signature,
          // La IP de salida de Vercel, distinta de la IP real firmada arriba.
          'x-real-ip': '56.125.190.173',
        },
        ip: '10.0.0.5',
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as LoginRequest;

      await controller.login(
        loginBody,
        signedReq,
        res as unknown as LoginResponse,
      );

      expect(loginSpy).toHaveBeenCalledWith(
        loginBody,
        expect.objectContaining({ ipAddress: clientIp }),
      );
    });

    it('una firma invalida ignora x-fentri-client-ip, cae a x-real-ip y no bloquea el login', async () => {
      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ access_token: 'jwt-token' });

      const timestamp = String(Date.now());
      const signedReq = {
        method: 'POST',
        originalUrl: '/auth/login',
        headers: {
          'x-fentri-client-ip': '186.11.74.13',
          'x-fentri-proxy-timestamp': timestamp,
          // Firma con formato valido (64 chars hex) pero contenido incorrecto.
          'x-fentri-proxy-signature': 'ab'.repeat(32),
          'x-real-ip': '56.125.190.173',
        },
        ip: '10.0.0.5',
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as LoginRequest;

      const body = await controller.login(
        loginBody,
        signedReq,
        res as unknown as LoginResponse,
      );

      expect(loginSpy).toHaveBeenCalledWith(
        loginBody,
        expect.objectContaining({ ipAddress: '56.125.190.173' }),
      );
      expect(body).toEqual({});
    });

    it('sin AUTH_PROXY_HMAC_SECRET configurado ignora x-fentri-client-ip y no bloquea el login', async () => {
      authProxySecret = undefined;
      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ access_token: 'jwt-token' });

      const timestamp = String(Date.now());
      const clientIp = '186.11.74.13';
      const signature = signTrustedClientIpPayload(
        'POST',
        '/auth/login',
        timestamp,
        clientIp,
        HMAC_SECRET,
      );

      const signedReq = {
        method: 'POST',
        originalUrl: '/auth/login',
        headers: {
          'x-fentri-client-ip': clientIp,
          'x-fentri-proxy-timestamp': timestamp,
          'x-fentri-proxy-signature': signature,
          'x-real-ip': '56.125.190.173',
        },
        ip: '10.0.0.5',
        socket: { remoteAddress: '10.0.0.5' },
      } as unknown as LoginRequest;

      const body = await controller.login(
        loginBody,
        signedReq,
        res as unknown as LoginResponse,
      );

      expect(loginSpy).toHaveBeenCalledWith(
        loginBody,
        expect.objectContaining({ ipAddress: '56.125.190.173' }),
      );
      expect(body).toEqual({});
    });
  });
});
