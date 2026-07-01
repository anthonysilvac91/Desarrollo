import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const AUTH_COOKIE_NAME = 'access_token';
const ACCESS_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

describe('AuthController cookie session', () => {
  const authService = {
    login: jest.fn(),
    loginWithTwoFactor: jest.fn(),
    loginWithEmailCode: jest.fn(),
    register: jest.fn(),
    registerOrganization: jest.fn(),
    logout: jest.fn(),
  } as unknown as AuthService;

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
    controller = new AuthController(authService);
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
});
